import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import RowMenu from '../Common/RowMenu';
import ConfirmDialog from '../Common/ConfirmDialog';
import Pill from '../Common/StatusBadge';
import EmptyState from '../Common/EmptyState';
import { useToast } from '../Common/Toast';
import { formatDate, isoDate } from '../../utils/format';
import { cents, money, sum } from '../../utils/money';

const InvoiceModal = ({ projectId, invoice, onClose, onSaved }) => {
  const toast = useToast();
  const [number, setNumber] = useState(invoice?.invoice_number || '');
  const [amount, setAmount] = useState(invoice?.amount ?? '');
  const [sent, setSent] = useState(invoice?.sent_date || '');
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (amount === '' || !(Number(amount) >= 0)) return setError('Enter the invoice amount (0 or more).');
    const row = { invoice_number: number.trim() || null, amount: Number(amount), sent_date: sent || null, notes: notes.trim() || null };
    setSaving(true);
    const { error: err } = invoice
      ? await supabase.from('client_invoices').update(row).eq('id', invoice.id)
      : await supabase.from('client_invoices').insert([{ ...row, project_id: projectId }]);
    if (err) { setError(err.message); setSaving(false); return; }
    toast.success(invoice ? 'Invoice updated' : 'Invoice added');
    onSaved();
  };

  return (
    <Modal
      title={invoice ? 'Edit client invoice' : 'Add client invoice'}
      size="sm"
      onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="invoice-form" loading={saving}>Save</Button></>}
    >
      <form id="invoice-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="form-label" htmlFor="ci-number">Invoice #</label>
          <input id="ci-number" className="form-control" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="ci-amount">Amount ($)<span className="required-mark" aria-hidden="true"> *</span></label>
          <input id="ci-amount" type="number" min="0" step="0.01" inputMode="decimal" className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="ci-sent">Date sent to client</label>
          <input id="ci-sent" type="date" className="form-control" value={sent} onChange={(e) => setSent(e.target.value)} />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="ci-notes">Notes</label>
          <textarea id="ci-notes" className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
      </form>
    </Modal>
  );
};

const PaymentModal = ({ payment, invoices, defaultInvoiceId, balanceOf, onClose, onSaved }) => {
  const toast = useToast();
  const [invoiceId, setInvoiceId] = useState(payment?.invoice_id || defaultInvoiceId || invoices[0]?.id || '');
  const [amount, setAmount] = useState(payment?.amount ?? '');
  const [date, setDate] = useState(payment?.payment_date || isoDate(new Date()));
  const [notes, setNotes] = useState(payment?.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const chosen = invoices.find((i) => i.id === invoiceId);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!invoiceId) return setError('Choose the invoice this payment is for.');
    if (!(Number(amount) > 0)) return setError('Enter a payment amount greater than 0.');
    if (!date) return setError('Enter the payment date.');
    const row = { invoice_id: invoiceId, amount: Number(amount), payment_date: date, notes: notes.trim() || null };
    setSaving(true);
    const { error: err } = payment
      ? await supabase.from('client_payments').update(row).eq('id', payment.id)
      : await supabase.from('client_payments').insert([row]);
    if (err) { setError(err.message); setSaving(false); return; }
    toast.success(payment ? 'Payment updated' : 'Payment recorded');
    onSaved();
  };

  return (
    <Modal
      title={payment ? 'Edit payment' : 'Record client payment'}
      size="sm"
      onClose={saving ? undefined : onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="payment-form" loading={saving}>Save</Button></>}
    >
      <form id="payment-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="form-label" htmlFor="cp-invoice">Invoice<span className="required-mark" aria-hidden="true"> *</span></label>
          <select id="cp-invoice" className="form-select" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoice_number || 'Invoice'} · {money(i.amount)}</option>)}
          </select>
          {chosen && <div className="field-help">Balance before this payment: {money(balanceOf(chosen) + (payment && payment.invoice_id === chosen.id ? Number(payment.amount) : 0))}</div>}
        </div>
        <div className="field">
          <label className="form-label" htmlFor="cp-amount">Amount ($)<span className="required-mark" aria-hidden="true"> *</span></label>
          <input id="cp-amount" type="number" min="0.01" step="0.01" inputMode="decimal" className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="cp-date">Payment date<span className="required-mark" aria-hidden="true"> *</span></label>
          <input id="cp-date" type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="cp-notes">Notes</label>
          <input id="cp-notes" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
      </form>
    </Modal>
  );
};

// Invoices sent to the client for this project, the payments received against them, and each invoice's balance.
const ClientInvoices = ({ projectId, finance }) => {
  const toast = useToast();
  const { invoices, payments, reload, balanceOf, totals } = finance;
  const [invoiceModal, setInvoiceModal] = useState(null);   // {} new | invoice row
  const [paymentModal, setPaymentModal] = useState(null);   // { payment?, invoiceId? }
  const [deleting, setDeleting] = useState(null);          // { kind: 'invoice' | 'payment', row }
  const [busy, setBusy] = useState(false);

  const invoiceLabel = (id) => {
    const i = invoices.find((x) => x.id === id);
    return i?.invoice_number || (i?.sent_date ? `Invoice of ${formatDate(i.sent_date)}` : 'Invoice');
  };

  const runDelete = async () => {
    setBusy(true);
    const table = deleting.kind === 'invoice' ? 'client_invoices' : 'client_payments';
    const { error } = await supabase.from(table).delete().eq('id', deleting.row.id);
    setBusy(false);
    if (error) { toast.error(`Couldn't delete: ${error.message}`); return; }
    toast.success(deleting.kind === 'invoice' ? 'Invoice deleted' : 'Payment deleted');
    setDeleting(null);
    reload();
  };

  const paidFor = (invoice) => cents(sum(payments.filter((p) => p.invoice_id === invoice.id), (p) => p.amount));

  return (
    <>
      <Card title="Client invoices" actions={<Button size="sm" onClick={() => setInvoiceModal({})}>Add invoice</Button>} flush>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices sent yet">Add each invoice you send to the client, then record the payments as they arrive.</EmptyState>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-scroll">
              <thead>
                <tr><th>Invoice #</th><th>Date sent</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th><th>Notes</th><th aria-label="Actions"></th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const bal = balanceOf(inv);
                  return (
                    <tr key={inv.id}>
                      <td className="cell-strong nowrap">{inv.invoice_number || '–'}</td>
                      <td className="nowrap">{inv.sent_date ? formatDate(inv.sent_date) : <span className="text-muted">Not sent</span>}</td>
                      <td className="num nowrap">{money(inv.amount)}</td>
                      <td className="num nowrap">{money(paidFor(inv))}</td>
                      <td className="num nowrap">
                        {bal <= 0 ? <Pill tone="success">Paid</Pill> : <span className="cell-strong">{money(bal)}</span>}
                      </td>
                      <td>{inv.notes || '–'}</td>
                      <td className="cell-actions">
                        <RowMenu
                          label={`Actions for invoice ${inv.invoice_number || ''}`}
                          items={[
                            { label: 'Record payment', onClick: () => setPaymentModal({ invoiceId: inv.id }) },
                            { label: 'Edit', onClick: () => setInvoiceModal(inv) },
                            { label: 'Delete', danger: true, onClick: () => setDeleting({ kind: 'invoice', row: inv }) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="num">Totals</td>
                  <td className="num nowrap">{money(totals.client)}</td>
                  <td className="num nowrap">{money(totals.paid)}</td>
                  <td className="num nowrap">{money(totals.outstanding)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Client payments"
        className="mt-4"
        actions={<Button size="sm" variant="secondary" onClick={() => setPaymentModal({})} disabled={invoices.length === 0}>Record payment</Button>}
        flush
      >
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded">{invoices.length === 0 ? 'Add an invoice first.' : 'Payments you record are listed here, and reduce the invoice balance.'}</EmptyState>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-scroll">
              <thead><tr><th>Date</th><th>Invoice</th><th className="num">Amount</th><th>Notes</th><th aria-label="Actions"></th></tr></thead>
              <tbody>
                {[...payments].sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date))).map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{formatDate(p.payment_date)}</td>
                    <td className="nowrap">{invoiceLabel(p.invoice_id)}</td>
                    <td className="num nowrap cell-strong">{money(p.amount)}</td>
                    <td>{p.notes || '–'}</td>
                    <td className="cell-actions">
                      <RowMenu
                        label="Payment actions"
                        items={[
                          { label: 'Edit', onClick: () => setPaymentModal({ payment: p }) },
                          { label: 'Delete', danger: true, onClick: () => setDeleting({ kind: 'payment', row: p }) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {invoiceModal && (
        <InvoiceModal projectId={projectId} invoice={invoiceModal.id ? invoiceModal : null} onClose={() => setInvoiceModal(null)} onSaved={() => { setInvoiceModal(null); reload(); }} />
      )}
      {paymentModal && (
        <PaymentModal
          payment={paymentModal.payment}
          invoices={invoices}
          defaultInvoiceId={paymentModal.invoiceId}
          balanceOf={balanceOf}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { setPaymentModal(null); reload(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={deleting.kind === 'invoice' ? 'Delete this invoice?' : 'Delete this payment?'}
          tone="danger"
          confirmLabel="Delete"
          busy={busy}
          onConfirm={runDelete}
          onCancel={() => setDeleting(null)}
        >
          {deleting.kind === 'invoice' ? (
            <p>{invoiceLabel(deleting.row.id)} ({money(deleting.row.amount)}) <strong>and every payment recorded against it</strong> will be deleted. This can&apos;t be undone.</p>
          ) : (
            <p>The {money(deleting.row.amount)} payment from {formatDate(deleting.row.payment_date)} will be deleted and the invoice balance will go back up.</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
};

export default ClientInvoices;
