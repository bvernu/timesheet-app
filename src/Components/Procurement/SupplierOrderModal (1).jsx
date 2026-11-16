import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import { useToast } from '../Common/Toast';
import SupplierPicker from './SupplierPicker';
import SupplierOrderFields from './SupplierOrderFields';
import { EMPTY_ORDER, orderToRow, validateOrder } from './constants';
import { checkPdf, openInvoicePdf, removeInvoicePdf, uploadInvoicePdf } from './invoicePdf';

const fromOrder = (o) => ({
  location: o.location || '', items: o.items || '', invoice_amount: o.invoice_amount ?? '', order_number: o.order_number || '',
  status: o.status || 'quote requested', lead_time: o.lead_time || '', order_date: o.order_date || '',
  ship_to: o.ship_to || '', tracking: o.tracking || '',
});

// Add a supplier to a project, or edit that supplier's order details. `order` = the existing row when editing.
const SupplierOrderModal = ({ project, tenantId, order, usedSupplierIds, supplierList, onClose, onSaved }) => {
  const toast = useToast();
  const { suppliers, addSupplier } = supplierList;
  const [supplier, setSupplier] = useState(order ? { id: order.supplier_id, name: order.suppliers?.name } : null);
  const [values, setValues] = useState(order ? fromOrder(order) : EMPTY_ORDER);
  const [pdfFile, setPdfFile] = useState(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pdfError = checkPdf(pdfFile);
  const setField = (f, v) => setValues((prev) => ({ ...prev, [f]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!supplier) return setError('Choose a supplier.');
    const problem = validateOrder(values, supplier.name) || pdfError;
    if (problem) return setError(problem);

    setSaving(true);
    try {
      const row = { ...orderToRow(values), supplier_id: supplier.id };
      let id = order?.id;
      let path = order?.invoice_pdf_path || null;
      const oldPath = path;
      if (removeExisting) path = null;

      if (order) {
        const { error: err } = await supabase.from('project_suppliers').update(row).eq('id', order.id);
        if (err) throw err;
      } else {
        id = crypto.randomUUID();
        const { error: err } = await supabase.from('project_suppliers').insert([{ ...row, id, project_id: project.id }]);
        if (err) throw err;
      }

      let pdfWarning = '';
      if (pdfFile) {
        try {
          path = await uploadInvoicePdf({ tenantId, projectId: project.id, orderId: id, file: pdfFile });
        } catch (err) {
          pdfWarning = `The order was saved, but the PDF could not be uploaded (${err.message}). Open the supplier again to retry.`;
        }
      }
      if (path !== (order?.invoice_pdf_path || null)) {
        const { error: err } = await supabase.from('project_suppliers').update({ invoice_pdf_path: path }).eq('id', id);
        if (err) throw err;
        if (oldPath && oldPath !== path) await removeInvoicePdf(oldPath);
      }

      if (pdfWarning) toast.error(pdfWarning); else toast.success(order ? 'Supplier updated' : 'Supplier added');
      onSaved();
    } catch (err) {
      setError(/duplicate key/i.test(err.message) ? 'That supplier is already on this project.' : err.message);
      setSaving(false);
    }
  };

  const openPdf = () => openInvoicePdf(order.invoice_pdf_path).catch((err) => toast.error(err.message));

  return (
    <Modal
      title={order ? `Edit ${supplier?.name || 'supplier'}` : 'Add supplier to project'}
      size="lg"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="supplier-order-form" loading={saving}>{order ? 'Save changes' : 'Add supplier'}</Button>
        </>
      }
    >
      <form id="supplier-order-form" onSubmit={submit} noValidate>
        {supplier ? (
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div><span className="text-muted small d-block">Supplier</span><strong>{supplier.name}</strong></div>
            <Button variant="quiet" size="sm" onClick={() => setSupplier(null)}>Change</Button>
          </div>
        ) : (
          <div className="mb-3">
            <SupplierPicker
              idPrefix="so"
              suppliers={suppliers}
              excludeIds={(usedSupplierIds || []).filter((id) => id !== order?.supplier_id)}
              onPick={setSupplier}
              onCreate={addSupplier}
              label="Supplier"
            />
          </div>
        )}
        <SupplierOrderFields
          idPrefix="so"
          value={values}
          onChange={setField}
          pdfFile={pdfFile}
          onPdf={setPdfFile}
          pdfError={pdfError}
          existingPdfPath={order?.invoice_pdf_path}
          removeExisting={removeExisting}
          onOpenPdf={openPdf}
          onRemoveExisting={() => setRemoveExisting(true)}
        />
        {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
      </form>
    </Modal>
  );
};

export default SupplierOrderModal;
