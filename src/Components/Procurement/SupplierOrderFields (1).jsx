import { ORDER_STATUSES, statusLabel } from './constants';
import { pdfFileName } from './invoicePdf';

// The details of ONE supplier on ONE project. Used when creating a project and when adding / editing a supplier later.
//   value: the form values   onChange(field, value)
//   pdfFile / onPdf: a PDF chosen but not uploaded yet     existingPdfPath / onOpenPdf / onRemovePdf: one already stored
const SupplierOrderFields = ({ idPrefix, value, onChange, pdfFile, onPdf, existingPdfPath, onOpenPdf, removeExisting, onRemoveExisting, pdfError }) => {
  const id = (n) => `${idPrefix}-${n}`;
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('items')}>Items<span className="required-mark" aria-hidden="true"> *</span></label>
        <input id={id('items')} className="form-control" value={value.items} onChange={set('items')} required />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('location')}>Location<span className="required-mark" aria-hidden="true"> *</span></label>
        <input id={id('location')} className="form-control" value={value.location} onChange={set('location')} required />
      </div>

      <div className="col-md-4">
        <label className="form-label" htmlFor={id('status')}>Status</label>
        <select id={id('status')} className="form-select" value={value.status} onChange={set('status')}>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={id('amount')}>Invoice amount ($)</label>
        <input id={id('amount')} type="number" min="0" step="0.01" inputMode="decimal" className="form-control"
               value={value.invoice_amount} onChange={set('invoice_amount')} />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={id('order')}>Order # / invoice #</label>
        <input id={id('order')} className="form-control" value={value.order_number} onChange={set('order_number')} />
      </div>

      <div className="col-12">
        <label className="form-label" htmlFor={id('pdf')}>Invoice PDF</label>
        {existingPdfPath && !removeExisting && (
          <div className="d-flex align-items-center gap-2 mb-2 small">
            <button type="button" className="btn-link-inline" onClick={onOpenPdf}>{pdfFileName(existingPdfPath)}</button>
            <button type="button" className="btn-link-inline text-danger" onClick={onRemoveExisting}>Remove</button>
          </div>
        )}
        <input id={id('pdf')} type="file" accept="application/pdf,.pdf" className="form-control"
               onChange={(e) => onPdf(e.target.files?.[0] || null)} aria-describedby={pdfError ? id('pdf-err') : undefined} />
        {pdfFile && <div className="field-help">Will upload “{pdfFile.name}” when you save{existingPdfPath && !removeExisting ? ' (replaces the current file)' : ''}.</div>}
        {pdfError && <div id={id('pdf-err')} className="text-danger small mt-1">{pdfError}</div>}
      </div>

      <div className="col-md-4">
        <label className="form-label" htmlFor={id('lead')}>Lead time</label>
        <input id={id('lead')} className="form-control" placeholder="e.g. 3 weeks" value={value.lead_time} onChange={set('lead_time')} />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={id('date')}>Order date</label>
        <input id={id('date')} type="date" className="form-control" value={value.order_date} onChange={set('order_date')} />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={id('ship')}>Ship to</label>
        <input id={id('ship')} className="form-control" value={value.ship_to} onChange={set('ship_to')} />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={id('track')}>Tracking information</label>
        <input id={id('track')} className="form-control" value={value.tracking} onChange={set('tracking')} />
      </div>
    </div>
  );
};

export default SupplierOrderFields;
