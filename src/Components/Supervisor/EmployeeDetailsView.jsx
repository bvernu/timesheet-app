import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import InputField from '../Common/InputField';

const EmployeeDetailsView = ({ employee, onClose, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
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

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Employee Details - {employee.full_name}</h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {!isEditing ? (
              <div>
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <th style={{ width: '30%' }}>Full Name</th>
                      <td>{employee.full_name}</td>
                    </tr>
                    <tr>
                      <th>Email</th>
                      <td>{employee.email || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>Phone</th>
                      <td>{employee.phone || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>SIN</th>
                      <td>{employee.sin || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>Pay Rate</th>
                      <td>{employee.pay_rate ? `$${employee.pay_rate}/hr` : 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>Joining Date</th>
                      <td>{employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>Address</th>
                      <td>{employee.address || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>Role</th>
                      <td>
                        <span className={`badge ${
                          employee.role === 'supervisor' ? 'bg-primary' : 
                          employee.role === 'manager' ? 'bg-warning' : 
                          'bg-success'
                        }`}>
                          {employee.role}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                <InputField
                  label="Email"
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(val) => setFormData(prev => ({ ...prev, email: val }))}
                />

                <InputField
                  label="Phone"
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(val) => setFormData(prev => ({ ...prev, phone: val }))}
                />

                <InputField
                  label="SIN"
                  id="sin"
                  value={formData.sin}
                  onChange={(val) => setFormData(prev => ({ ...prev, sin: val }))}
                />

                <InputField
                  label="Pay Rate ($/hour)"
                  id="pay_rate"
                  type="number"
                  step="0.01"
                  value={formData.pay_rate}
                  onChange={(val) => setFormData(prev => ({ ...prev, pay_rate: val }))}
                />

                <div className="mb-3">
                  <label className="form-label">Joining Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.joining_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, joining_date: e.target.value }))}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                {error && (
                  <div className="alert alert-danger">{error}</div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            {!isEditing ? (
              <>
                <Button variant="primary" onClick={() => setIsEditing(true)}>
                  Edit Details
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="primary" 
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      email: employee.email || '',
                      phone: employee.phone || '',
                      sin: employee.sin || '',
                      pay_rate: employee.pay_rate || '',
                      joining_date: employee.joining_date || '',
                      address: employee.address || ''
                    });
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsView;