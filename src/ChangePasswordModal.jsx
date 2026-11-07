import { useState } from 'react';
import { supabase } from './supabaseClient';
import Button from './Components/Common/Button';
import Modal from './Components/Common/Modal';
import InputField from './Components/Common/InputField';

const ChangePasswordModal = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess('Password changed successfully!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Change password"
      size="sm"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="change-password-form" loading={loading}>Change password</Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleChangePassword}>
        <InputField
          label="New password"
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          required
        />

        <InputField
          label="Confirm new password"
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          required
        />

        {error && (
          <div className="alert alert-danger mb-0" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-0" role="status">
            {success}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
