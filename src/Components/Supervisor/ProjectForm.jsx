import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import InputField from '../Common/InputField';
import { useToast } from '../Common/Toast';
import { useTenant } from '../../tenant/TenantContext';
import { useTenantSettings } from '../../tenant/settings';
import { useSuppliers } from '../Procurement/useSuppliers';
import SupplierPicker from '../Procurement/SupplierPicker';
import SupplierOrderFields from '../Procurement/SupplierOrderFields';
import { EMPTY_ORDER, orderToRow, validateOrder } from '../Procurement/constants';
import { checkPdf, uploadInvoicePdf } from '../Procurement/invoicePdf';

const ProjectForm = ({ project, employees, nextSerialNumber, typeSuggestions = [], onClose, onSave }) => {
  const toast = useToast();
  const tenant = useTenant();
  const { procurement } = useTenantSettings();
  const supplierList = useSuppliers();
  // Suppliers chosen while CREATING a project: [{ supplier, values, pdfFile }]. After creation they are managed on the project page.
  const [chosen, setChosen] = useState([]);
  const [formData, setFormData] = useState({
    serial_number: project?.serial_number || nextSerialNumber || '',
    address: project?.address || '',
    type: project?.type || (procurement ? '' : 'DGN'),
    company_name: project?.company_name || '',
    contact_person: project?.contact_person || '',
    email: project?.email || '',
    phone: project?.phone || '',
    job_description: project?.job_description || '',
    status: project?.status || 'in progress',
    quotation_amount: project?.quotation_amount || '',
    quotation_date: project?.quotation_date || '',
    invoice_amount: project?.invoice_amount || '',
    invoice_date: project?.invoice_date || '',
    payment_amount: project?.payment_amount || '',
    payment_date: project?.payment_date || '',
    project_lead_id: project?.project_lead_id || '',
    notes: project?.notes || ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    // Format phone number as user types
    if (field === 'phone') {
      // Remove all non-digits
      const digits = value.replace(/\D/g, '');
      
      // Format as (###) ###-####
      let formatted = '';
      if (digits.length > 0) {
        formatted = '(' + digits.substring(0, 3);
        if (digits.length > 3) {
          formatted += ') ' + digits.substring(3, 6);
        }
        if (digits.length > 6) {
          formatted += '-' + digits.substring(6, 10);
        }
      }
      
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate required fields
    if (!formData.address || !formData.type || !formData.contact_person) {
      setError(procurement ? 'Project name, project type, and contact person are required' : 'Address, type, and contact person are required');
      setLoading(false);
      return;
    }

    // A new project needs at least one supplier, each with its items and location
    if (procurement && !project) {
      if (chosen.length === 0) {
        setError('Add at least one supplier to the project.');
        setLoading(false);
        return;
      }
      for (const c of chosen) {
        const problem = validateOrder(c.values, c.supplier.name) || checkPdf(c.pdfFile);
        if (problem) {
          setError(problem);
          setLoading(false);
          return;
        }
      }
    }

    // Validate phone format (basic validation for North American format)
    if (formData.phone && !/^[\d\s\-\(\)]+$/.test(formData.phone)) {
      setError('Please enter a valid phone number (numbers, spaces, dashes, and parentheses only)');
      setLoading(false);
      return;
    }

    try {
      const dataToSave = {
        address: formData.address,
        name: formData.address, // Set name to address for compatibility
        type: formData.type,
        company_name: formData.company_name || null,
        contact_person: formData.contact_person,
        email: formData.email || null,
        phone: formData.phone || null,
        job_description: formData.job_description || null,
        status: formData.status,
        quotation_amount: formData.quotation_amount ? parseFloat(formData.quotation_amount) : null,
        quotation_date: formData.quotation_date || null,
        project_lead_id: formData.project_lead_id || null,
        notes: formData.notes || null
      };
      // Companies that track invoices and payments on the project page don't use these single fields: leave them untouched
      if (!procurement) {
        dataToSave.invoice_amount = formData.invoice_amount ? parseFloat(formData.invoice_amount) : null;
        dataToSave.payment_amount = formData.payment_amount ? parseFloat(formData.payment_amount) : null;
        dataToSave.invoice_date = formData.invoice_date || null;
        dataToSave.payment_date = formData.payment_date || null;
      }

      if (project) {
        // Update existing project - include serial_number if changed
        const updateData = {
          ...dataToSave,
          serial_number: formData.serial_number ? parseInt(formData.serial_number) : project.serial_number
        };
        
        const { error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', project.id);
        
        if (error) throw error;
      } else {
        // Create new project - include serial_number if provided
        if (formData.serial_number) {
          dataToSave.serial_number = parseInt(formData.serial_number);
        }
        
        const { data: created, error } = await supabase
          .from('projects')
          .insert([dataToSave])
          .select('id')
          .single();

        if (error) throw error;

        if (procurement) {
          // Link the suppliers. If that fails the new project is removed again, so a project never exists without them.
          const rows = chosen.map((c) => ({ ...orderToRow(c.values), id: crypto.randomUUID(), project_id: created.id, supplier_id: c.supplier.id }));
          const { error: linkError } = await supabase.from('project_suppliers').insert(rows);
          if (linkError) {
            await supabase.from('projects').delete().eq('id', created.id);
            throw new Error(`The project was not created because its suppliers could not be saved: ${linkError.message}`);
          }
          // PDFs go up last (they need the project to exist). A failed upload doesn't undo the project: it can be re-attached.
          const failed = [];
          for (let i = 0; i < chosen.length; i += 1) {
            if (!chosen[i].pdfFile) continue;
            try {
              const path = await uploadInvoicePdf({ tenantId: tenant.id, projectId: created.id, orderId: rows[i].id, file: chosen[i].pdfFile });
              const { error: upErr } = await supabase.from('project_suppliers').update({ invoice_pdf_path: path }).eq('id', rows[i].id);
              if (upErr) throw upErr;
            } catch {
              failed.push(chosen[i].supplier.name);
            }
          }
          if (failed.length > 0) toast.error(`The project was saved, but the invoice PDF for ${failed.join(', ')} could not be uploaded. Open the project and edit the supplier to attach it again.`);
        }
      }

      onSave();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={project ? `Edit project #${project.serial_number}` : 'Add project'}
      size="lg"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="project-form" loading={loading}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit}>
        <div className="row">
          {/* Basic information */}
          <div className="col-md-6">
            <h6 className="form-section-title">Basic information</h6>
            
            <InputField
              label="Serial number"
              id="serial_number"
              type="number"
              value={formData.serial_number}
              onChange={(val) => handleChange('serial_number', val)}
              required
            />

            <div className="mb-3">
              <label className="form-label" htmlFor="project-name">
                {procurement ? 'Project name' : 'Address (project title)'} <span className="text-danger">*</span>
              </label>
              <textarea
                id="project-name"
                className="form-control"
                rows={2}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                required
              />
            </div>
            
            <InputField
              label="Contact person"
              id="contact_person"
              value={formData.contact_person}
              onChange={(val) => handleChange('contact_person', val)}
              required
            />

            <InputField
              label={procurement ? 'Client name' : 'Company name'}
              id="company_name"
              value={formData.company_name}
              onChange={(val) => handleChange('company_name', val)}
            />

            <InputField
              label="Email"
              id="email"
              type="email"
              value={formData.email}
              onChange={(val) => handleChange('email', val)}
            />

            <InputField
              label="Phone"
              id="phone"
              type="text"
              value={formData.phone}
              onChange={(val) => handleChange('phone', val)}
              className="form-control"
            />
          </div>

          {/* Project Details */}
          <div className="col-md-6">
            <h6 className="form-section-title">Project details</h6>

            {procurement ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="project-type">
                  Project type <span className="text-danger">*</span>
                </label>
                <input
                  id="project-type"
                  className="form-control"
                  list="project-type-options"
                  placeholder="e.g. Laundry room, Conference room"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  required
                />
                <datalist id="project-type-options">
                  {typeSuggestions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
            ) : (
            <div className="mb-3">
              <label className="form-label" htmlFor="project-type-select">
                Type <span className="text-danger">*</span>
              </label>
              <select
                id="project-type-select"
                className="form-select"
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                required
              >
                <option value="DGN">DGN - Design</option>
                <option value="DET">DET - Detailing</option>
                <option value="FAB">FAB - Fabrication</option>
                <option value="CON">CON - Construction</option>
                <option value="FNE">FNE - Fabrication and Erection</option>
                <option value="DEF">DEF - Design, Erection, and Fabrication</option>
              </select>
            </div>
            )}

            <div className="mb-3">
              <label className="form-label">
                Status <span className="text-danger">*</span>
              </label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                required
              >
                <option value="quote sent">Quote Sent</option>
                <option value="in progress">In Progress</option>
                <option value="40%">40%</option>
                <option value="50% completed">50% Completed</option>
                <option value="60%">60%</option>
                <option value="invoiced">Invoiced</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Project lead</label>
              <select
                className="form-select"
                value={formData.project_lead_id}
                onChange={(e) => handleChange('project_lead_id', e.target.value)}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Job description</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.job_description}
                onChange={(e) => handleChange('job_description', e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Financial Information */}
        <div className="row mt-3">
          <div className="col-12">
            <h6 className="form-section-title">Financial information</h6>
          </div>

          <div className="col-md-4">
            <h6 className="form-section-title">Quotation</h6>
            <InputField
              label="Amount"
              id="quotation_amount"
              type="number"
              value={formData.quotation_amount}
              onChange={(val) => handleChange('quotation_amount', val)}
            />
            <div className="mb-3">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.quotation_date}
                onChange={(e) => handleChange('quotation_date', e.target.value)}
              />
            </div>
          </div>
          {procurement && (
            <div className="col-md-8">
              <p className="text-muted small mt-4 mb-0">
                Client invoices and payments, supplier invoices and the profit are tracked on the project page once it is created.
              </p>
            </div>
          )}
          {!procurement && (
          <>
          <div className="col-md-4">
            <h6 className="form-section-title">Invoice</h6>
            <InputField
              label="Amount"
              id="invoice_amount"
              type="number"
              value={formData.invoice_amount}
              onChange={(val) => handleChange('invoice_amount', val)}
            />
            <div className="mb-3">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.invoice_date}
                onChange={(e) => handleChange('invoice_date', e.target.value)}
              />
            </div>
          </div>

          <div className="col-md-4">
            <h6 className="form-section-title">Payment</h6>
            <InputField
              label="Amount"
              id="payment_amount"
              type="number"
              value={formData.payment_amount}
              onChange={(val) => handleChange('payment_amount', val)}
            />
            <div className="mb-3">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.payment_date}
                onChange={(e) => handleChange('payment_date', e.target.value)}
              />
            </div>
          </div>
          </>
          )}
        </div>

        {procurement && !project && (
          <div className="mt-4">
            <h6 className="form-section-title">Suppliers <span className="text-danger">*</span></h6>
            <p className="text-muted small">Add every supplier used on this project (at least one). Items and location are required for each.</p>
            <SupplierPicker
              idPrefix="newproj"
              suppliers={supplierList.suppliers}
              excludeIds={chosen.map((c) => c.supplier.id)}
              onCreate={supplierList.addSupplier}
              onPick={(supplier) => setChosen((list) => [...list, { key: supplier.id, supplier, values: { ...EMPTY_ORDER }, pdfFile: null }])}
              label="Add a supplier"
              disabled={loading}
            />
            {chosen.map((c, idx) => (
              <div key={c.key} className="supplier-block">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>{c.supplier.name}</strong>
                  <Button variant="quiet" size="sm" onClick={() => setChosen((list) => list.filter((x) => x.key !== c.key))} aria-label={`Remove ${c.supplier.name}`}>Remove</Button>
                </div>
                <SupplierOrderFields
                  idPrefix={`np${idx}`}
                  value={c.values}
                  onChange={(field, val) => setChosen((list) => list.map((x) => (x.key === c.key ? { ...x, values: { ...x.values, [field]: val } } : x)))}
                  pdfFile={c.pdfFile}
                  onPdf={(file) => setChosen((list) => list.map((x) => (x.key === c.key ? { ...x, pdfFile: file } : x)))}
                  pdfError={checkPdf(c.pdfFile)}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ProjectForm;
