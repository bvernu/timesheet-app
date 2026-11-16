import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import RowMenu from '../Common/RowMenu';
import ConfirmDialog from '../Common/ConfirmDialog';
import Pill from '../Common/StatusBadge';
import EmptyState from '../Common/EmptyState';
import { useToast } from '../Common/Toast';
import { useTenant } from '../../tenant/TenantContext';
import { formatDate } from '../../utils/format';
import { money } from '../../utils/money';
import SupplierOrderModal from './SupplierOrderModal';
import { statusLabel } from './constants';
import { openInvoicePdf, removeInvoicePdf } from './invoicePdf';

const STATUS_TONE = {
  'quote requested': 'neutral',
  'quote received': 'warning',
  'order issued': 'warning',
  ordered: 'info',
  'in transit': 'info',
  delivered: 'success',
  'delivered to carmen warehouse': 'success',
};

// The suppliers on one project, each with that order's details. Add, edit and remove after the project exists.
const ProjectSuppliers = ({ project, finance, supplierList }) => {
  const toast = useToast();
  const tenant = useTenant();
  const { orders, reload } = finance;
  const [editing, setEditing] = useState(null);     // an order row, or {} for a new one
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from('project_suppliers').delete().eq('id', removing.id);
    setBusy(false);
    if (error) { toast.error(`Couldn't remove the supplier: ${error.message}`); return; }
    await removeInvoicePdf(removing.invoice_pdf_path).catch(() => {});
    toast.success(`${removing.suppliers?.name || 'Supplier'} removed from this project`);
    setRemoving(null);
    reload();
  };

  const openPdf = (path) => openInvoicePdf(path).catch((err) => toast.error(err.message));

  return (
    <Card title="Suppliers" actions={<Button size="sm" onClick={() => setEditing({})}>Add supplier</Button>} flush>
      {orders.length === 0 ? (
        <EmptyState title="No suppliers on this project">Add a supplier to track its order, invoice and delivery.</EmptyState>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-scroll">
            <thead>
              <tr>
                <th>Supplier</th><th>Location</th><th>Items</th><th>Status</th>
                <th className="num">Invoice amount</th><th>Order / invoice #</th><th>Lead time</th>
                <th>Order date</th><th>Ship to</th><th>Tracking</th><th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="cell-strong nowrap">{o.suppliers?.name}</td>
                  <td>{o.location}</td>
                  <td>{o.items}</td>
                  <td><Pill tone={STATUS_TONE[o.status] || 'neutral'}>{statusLabel(o.status)}</Pill></td>
                  <td className="num nowrap">{o.invoice_amount === null ? '–' : money(o.invoice_amount)}</td>
                  <td className="nowrap">
                    {o.invoice_pdf_path
                      ? <button type="button" className="btn-link-inline" onClick={() => openPdf(o.invoice_pdf_path)} title="Open the invoice PDF">{o.order_number || 'Invoice PDF'} ↗</button>
                      : (o.order_number || '–')}
                  </td>
                  <td>{o.lead_time || '–'}</td>
                  <td className="nowrap">{o.order_date ? formatDate(o.order_date) : '–'}</td>
                  <td>{o.ship_to || '–'}</td>
                  <td>{o.tracking || '–'}</td>
                  <td className="cell-actions">
                    <RowMenu
                      label={`Actions for ${o.suppliers?.name || 'supplier'}`}
                      items={[
                        { label: 'Edit', onClick: () => setEditing(o) },
                        { label: 'Remove from project', danger: true, onClick: () => setRemoving(o) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="num">Total supplier invoices</td>
                <td className="num nowrap">{money(finance.totals.supplier)}</td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && (
        <SupplierOrderModal
          project={project}
          tenantId={tenant.id}
          order={editing.id ? editing : null}
          usedSupplierIds={orders.map((o) => o.supplier_id)}
          supplierList={supplierList}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remove this supplier from the project?"
          tone="danger"
          confirmLabel="Remove"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        >
          <p>
            <strong>{removing.suppliers?.name}</strong> and its order details{removing.invoice_pdf_path ? ' (including the invoice PDF)' : ''} will be removed
            from this project{removing.invoice_amount ? ` and ${money(removing.invoice_amount)} will no longer count toward the supplier total` : ''}.
            The supplier stays in your supplier list and on other projects.
          </p>
        </ConfirmDialog>
      )}
    </Card>
  );
};

export default ProjectSuppliers;
