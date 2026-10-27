import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Button from '../Common/Button';
import InputField from '../Common/InputField';
import Modal from '../Common/Modal';
import { RoleBadge } from '../Common/StatusBadge';
import { formatDate } from '../../utils/format';

// Shows only the last 3 characters of a SIN until the viewer asks to reveal it
const maskSin = (sin) => (sin ? `••• ••• ${String(sin).replace(/\D/g, '').slice(-3)}` : '');

const EmployeeDetailsView = ({ employee, onClose, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [revealSin, setRevealSin] = useState(false);
  const [formData, setFormData] = useState({
    email: employee.email || '',
    phone: employee.phone || '',
    sin: employee.sin || '',
    pay_rate: employee.pay_rate || '',
    joining_date: employee.joining_date || '',
    address: employee.address || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email: formData.email,
          phone: formData.phone || null,
          sin: formData.sin || null,
          pay_rate: formData.pay_rate ? parseFloat(formData.pay_rate) : null,
          joining_date: formData.joining_date || null,
          address: formData.address || null
        })
        .eq('id', employee.id);

      if (error) throw error;

      setIsEditing(false);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError('');
    setFormData({
      email: employee.email || '',
      phone: employee.phone || '',
      sin: employee.sin || '',
      pay_rate: employee.pay_rate || '',
      joining_date: employee.joining_date || '',
      address: employee.address || ''
    });
  };

  return (
    <Modal
      title={employee.full_name}
      size="lg"
      onClose={loading ? undefined : onClose}
      footer={
        !isEditing ? (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={() => setIsEditing(true)}>Edit details</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={cancelEdit} disabled={loading}>Cancel</Button>
            <Button onClick={handleSave} loading={loading}>Save changes</Button>
          </>
        )
      }
    >
      {!isEditing ? (
        <dl className="detail-list">
          <dt>Role</dt><dd><RoleBadge role={employee.role} /></dd>
          <dt>Email</dt><dd>{employee.email || 'Not provided'}</dd>
          <dt>Phone</dt><dd>{employee.phone || 'Not provided'}</dd>
          <dt>SIN</dt>
          <dd>
            {employee.sin ? (
              <span className="d-inline-flex align-items-center gap-2">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{revealSin ? employee.sin : maskSin(employee.sin)}</span>
                <Button variant="quiet" size="sm" onClick={() => setRevealSin((v) => !v)}>
                  {revealSin ? 'Hide' : 'Show'}
                </Button>
              </span>
            ) : 'Not provided'}
          </dd>
          <dt>Pay rate</dt><dd>{employee.pay_rate ? `$${Number(employee.pay_rate).toFixed(2)} / hour` : 'Not provided'}</dd>
          <dt>Joining date</dt><dd>{employee.joining_date ? formatDate(`${employee.joining_date}T00:00:00`) : 'Not provided'}</dd>
          <dt>Address</dt><dd>{employee.address || 'Not provided'}</dd>
        </dl>
      ) : (
        <div>
          <InputField
            label="Email"
            id="email"
            type="email"
            value={formData.email}
            onChange={(val) => setFormData((prev) => ({ ...prev, email: val }))}
          />

          <InputField
            label="Phone"
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
          />

          <div className="row">
            <div className="col-md-6">
              <InputField
                label="SIN"
                id="sin"
                value={formData.sin}
                onChange={(val) => setFormData((prev) => ({ ...prev, sin: val }))}
                autoComplete="off"
              />
            </div>
            <div className="col-md-6">
              <InputField
                label="Pay rate ($ / hour)"
                id="pay_rate"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={formData.pay_rate}
                onChange={(val) => setFormData((prev) => ({ ...prev, pay_rate: val }))}
              />
            </div>
          </div>

          <div className="field">
            <label className="form-label" htmlFor="joining_date">Joining date</label>
            <input
              id="joining_date"
              type="date"
              className="form-control"
              value={formData.joining_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, joining_date: e.target.value }))}
            />
          </div>

          <div className="field">
            <label className="form-label" htmlFor="address">Address</label>
            <textarea
              id="address"
              className="form-control"
              rows={3}
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>

          {error && <div className="alert alert-danger mb-0">{error}</div>}
        </div>
      )}
    </Modal>
  );
};

export default EmployeeDetailsView;
