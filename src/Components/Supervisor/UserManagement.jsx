import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import InputField from '../Common/InputField';

const UserManagement = ({ employees, onRefresh, currentUser }) => {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: ''
  });
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Create user in Supabase Auth with temporary password
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name
        }
      });

      if (authError) throw authError;

      // Create profile (this should happen automatically via trigger, but we can ensure it)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          role: 'employee'
        });

      if (profileError) throw profileError;

      setSuccess(`Employee created successfully! Temporary password: ${formData.password}`);
      setFormData({ email: '', full_name: '', password: '' });
      setShowAddEmployee(false);
      setTimeout(() => {
        setSuccess('');
        onRefresh();
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async (email) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

      if (error) throw error;

      setSuccess(`Password reset email sent to ${email}`);
      setShowResetPassword(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (employeeId, currentRole) => {
    const newRole = currentRole === 'supervisor' ? 'employee' : 'supervisor';
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', employeeId);
      
      if (error) throw error;
      
      setSuccess('Role updated successfully!');
      setTimeout(() => setSuccess(''), 2000);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to update role');
    }
  };

  const handleDeleteEmployee = async (employeeId, employeeEmail) => {
    if (!confirm(`Are you sure you want to delete ${employeeEmail}? This will remove all their data.`)) {
      return;
    }

    try {
      // Delete from profiles (cascade will handle time_entries)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', employeeId);

      if (error) throw error;

      // Note: Deleting from auth.users requires admin privileges
      // This would need to be done via a Supabase Edge Function or backend
      
      setSuccess('Employee deleted successfully!');
      setTimeout(() => setSuccess(''), 2000);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to delete employee');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  return (
    <div>
      <div className="row mb-3">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <h4>Employee Management</h4>
            <Button onClick={() => setShowAddEmployee(true)} variant="primary">
              Create New Employee
            </Button>
          </div>
        </div>
      </div>

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {showAddEmployee && (
        <Card title="Create New Employee" className="mb-4">
          <form onSubmit={handleCreateEmployee}>
            <div className="row">
              <div className="col-md-6">
                <InputField
                  label="Full Name"
                  id="full_name"
                  value={formData.full_name}
                  onChange={(val) => setFormData(prev => ({ ...prev, full_name: val }))}
                  required
                />
              </div>
              <div className="col-md-6">
                <InputField
                  label="Email"
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(val) => setFormData(prev => ({ ...prev, email: val }))}
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-8">
                <InputField
                  label="Temporary Password"
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(val) => setFormData(prev => ({ ...prev, password: val }))}
                  required
                />
                <small className="text-muted">
                  Employee will be able to change this password after first login
                </small>
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <Button 
                  type="button" 
                  onClick={generatePassword} 
                  variant="secondary"
                  className="mb-3"
                >
                  Generate Password
                </Button>
              </div>
            </div>

            <div className="d-flex gap-2 mt-3">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Employee'}
              </Button>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => {
                  setShowAddEmployee(false);
                  setFormData({ email: '', full_name: '', password: '' });
                  setError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.full_name}</td>
                  <td>{employee.email}</td>
                  <td>
                    <span className={`badge ${
                      employee.role === 'supervisor' 
                        ? 'bg-primary' 
                        : 'bg-success'
                    }`}>
                      {employee.role}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleRole(employee.id, employee.role)}
                      className="btn btn-sm btn-outline-primary me-2"
                      disabled={employee.id === currentUser.id}
                      title={employee.id === currentUser.id ? "Can't change your own role" : "Toggle role"}
                    >
                      Toggle Role
                    </button>
                    <button
                      onClick={() => setShowResetPassword(employee)}
                      className="btn btn-sm btn-outline-warning me-2"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(employee.id, employee.email)}
                      className="btn btn-sm btn-outline-danger"
                      disabled={employee.id === currentUser.id}
                      title={employee.id === currentUser.id ? "Can't delete yourself" : "Delete employee"}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showResetPassword && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Reset Password</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowResetPassword(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Send password reset email to <strong>{showResetPassword.email}</strong>?</p>
                <p className="text-muted small">
                  The employee will receive an email with a link to reset their password.
                </p>
              </div>
              <div className="modal-footer">
                <Button 
                  variant="secondary" 
                  onClick={() => setShowResetPassword(null)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => handleSendPasswordReset(showResetPassword.email)}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Email'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;