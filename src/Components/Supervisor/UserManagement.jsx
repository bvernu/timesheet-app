import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import InputField from '../Common/InputField';
import Modal from '../Common/Modal';
import PageHeader from '../Common/PageHeader';
import RowMenu from '../Common/RowMenu';
import Skeleton from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import { RoleBadge } from '../Common/StatusBadge';
import { useToast } from '../Common/Toast';
import EmployeeDetailsView from './EmployeeDetailsView';

const EMPTY_FORM = { email: '', full_name: '', password: '' };

const UserManagement = ({ employees, onRefresh, currentUser, loading: listLoading = false }) => {
  const toast = useToast();
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(null);
  const [changingRole, setChangingRole] = useState(null); // { employee, role }
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null); // { email, password } after a successful create
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const closeAddDialog = () => {
    setShowAddEmployee(false);
    setFormData(EMPTY_FORM);
    setCreated(null);
    setCopied(false);
    setError('');
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Accounts are created by a server-side function, which puts the new employee in the same
      // company as the supervisor creating them.
      const { error: fnError } = await supabase.functions.invoke('create-employee', {
        body: {
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password
        }
      });

      if (fnError) {
        let message = fnError.message;
        try {
          const body = await fnError.context.json();
          if (body?.error) message = body.error;
        } catch { /* keep the generic message */ }
        throw new Error(message);
      }

      setCreated({ email: formData.email, password: formData.password });
      toast.success('Employee account created');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.password}`);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy automatically. Please select and copy the details above.");
    }
  };

  const handleSendPasswordReset = async (email) => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

      if (error) throw error;

      toast.success(`Password reset email sent to ${email}`);
      setShowResetPassword(null);
    } catch (err) {
      toast.error(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async () => {
    const { employee, role } = changingRole;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', employee.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No rows updated. Check RLS policies.');
      }

      toast.success(`${employee.full_name} is now ${role === 'employee' ? 'an employee' : `a ${role}`}`);
      setChangingRole(null);
      onRefresh();
    } catch (err) {
      toast.error(`Failed to update role: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const values = new Uint32Array(12);
    crypto.getRandomValues(values);
    const password = Array.from(values, (v) => chars.charAt(v % chars.length)).join('');
    setFormData((prev) => ({ ...prev, password }));
  };

  const visibleEmployees = employees.filter((emp) => emp.role !== 'deleted');

  return (
    <div>
      <PageHeader
        title="Employees"
        actions={<Button onClick={() => setShowAddEmployee(true)}>Add employee</Button>}
      />

      <Card flush>
        {listLoading ? (
          <Skeleton rows={4} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-stack">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr key={employee.id} className="is-clickable" onClick={() => setViewingEmployee(employee)}>
                    <td className="cell-title cell-strong">{employee.full_name}</td>
                    <td data-label="Email">{employee.email}</td>
                    <td data-label="Role"><RoleBadge role={employee.role} /></td>
                    <td className="cell-actions" data-label="" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        label={`Actions for ${employee.full_name}`}
                        items={[
                          { label: 'View details', onClick: () => setViewingEmployee(employee) },
                          { label: 'Change role', hidden: employee.id === currentUser.id, onClick: () => setChangingRole({ employee, role: employee.role }) },
                          { label: 'Send password reset', onClick: () => setShowResetPassword(employee) },
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

      {showAddEmployee && (
        created ? (
          <Modal
            title="Employee created"
            onClose={closeAddDialog}
            footer={
              <>
                <Button variant="secondary" onClick={copyCredentials}>{copied ? 'Copied ✓' : 'Copy details'}</Button>
                <Button onClick={closeAddDialog}>Done</Button>
              </>
            }
          >
            <p>They can sign in right away with these details. Share the password securely, as it won&apos;t be shown again.</p>
            <dl className="detail-list">
              <dt>Email</dt><dd>{created.email}</dd>
              <dt>Temporary password</dt><dd><code>{created.password}</code></dd>
            </dl>
          </Modal>
        ) : (
          <Modal
            title="Add employee"
            onClose={loading ? undefined : closeAddDialog}
            footer={
              <>
                <Button variant="secondary" onClick={closeAddDialog} disabled={loading}>Cancel</Button>
                <Button type="submit" form="add-employee-form" loading={loading}>Create employee</Button>
              </>
            }
          >
            <form id="add-employee-form" onSubmit={handleCreateEmployee}>
              <InputField
                label="Full name"
                id="full_name"
                value={formData.full_name}
                onChange={(val) => setFormData((prev) => ({ ...prev, full_name: val }))}
                required
              />
              <InputField
                label="Email"
                id="email"
                type="email"
                value={formData.email}
                onChange={(val) => setFormData((prev) => ({ ...prev, email: val }))}
                required
              />
              <div className="field">
                <label htmlFor="password" className="form-label">
                  Temporary password<span className="required-mark" aria-hidden="true"> *</span>
                </label>
                <div className="d-flex gap-2">
                  <input
                    id="password"
                    type="text"
                    className="form-control"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    minLength={8}
                    autoComplete="off"
                    required
                  />
                  <Button variant="secondary" onClick={generatePassword}>Generate</Button>
                </div>
                <div className="field-help">At least 8 characters. The employee can change it after signing in.</div>
              </div>

              {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
            </form>
          </Modal>
        )
      )}

      {viewingEmployee && (
        <EmployeeDetailsView
          employee={viewingEmployee}
          onClose={() => setViewingEmployee(null)}
          onSave={() => {
            setViewingEmployee(null);
            toast.success('Employee details saved');
            onRefresh();
          }}
        />
      )}

      {changingRole && (
        <Modal
          title={`Change role for ${changingRole.employee.full_name}`}
          size="sm"
          onClose={loading ? undefined : () => setChangingRole(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setChangingRole(null)} disabled={loading}>Cancel</Button>
              <Button onClick={handleChangeRole} loading={loading} disabled={changingRole.role === changingRole.employee.role}>
                Save role
              </Button>
            </>
          }
        >
          <div className="field mb-0">
            <label className="form-label" htmlFor="role-select">Role</label>
            <select
              id="role-select"
              className="form-select"
              value={changingRole.role}
              onChange={(e) => setChangingRole((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
            </select>
            <div className="field-help">Supervisors can approve timesheets and manage employees. Managers can manage projects.</div>
          </div>
        </Modal>
      )}

      {showResetPassword && (
        <ConfirmDialog
          title="Send password reset email?"
          confirmLabel="Send email"
          busy={loading}
          onConfirm={() => handleSendPasswordReset(showResetPassword.email)}
          onCancel={() => setShowResetPassword(null)}
        >
          <p>We&apos;ll email <strong>{showResetPassword.email}</strong> a link to choose a new password.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default UserManagement;
