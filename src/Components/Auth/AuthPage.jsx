import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import InputField from '../Common/InputField';
import Button from '../Common/Button';
import BrandLogo from '../../tenant/BrandLogo';
import { useTenant } from '../../tenant/TenantContext';

const AuthPage = ({ notice = '', onClearNotice = () => {} }) => {
  const tenant = useTenant();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    onClearNotice();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      setMessage('Password reset email sent! Check your inbox.');
      setTimeout(() => setShowForgotPassword(false), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (forgot) => {
    setShowForgotPassword(forgot);
    setError('');
    setMessage('');
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-panel">
          {/* The logo sits on the company's top-bar colour, because that is what it was designed for */}
          <div className="auth-brand">
            <BrandLogo height={48} className="" />
          </div>

          <div className="auth-body">
            <h1 className="auth-title">{showForgotPassword ? 'Reset your password' : 'Sign in'}</h1>
            <p className="auth-subtitle">
              {showForgotPassword
                ? "Enter your email and we'll send you a reset link."
                : `Welcome to the ${tenant.name} timesheet.`}
            </p>

            <form onSubmit={showForgotPassword ? handleForgotPassword : handleAuth}>
              <InputField
                label="Email"
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                required
              />

              {!showForgotPassword && (
                <div className="field">
                  <label htmlFor="password" className="form-label">
                    Password<span className="required-mark" aria-hidden="true"> *</span>
                  </label>
                  <div className="password-field">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {notice && !error && (
                <div className="alert alert-warning" role="alert">
                  {notice}
                </div>
              )}

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {message && (
                <div className="alert alert-success" role="status">
                  {message}
                </div>
              )}

              <Button type="submit" variant="primary" loading={loading} className="w-100">
                {showForgotPassword ? 'Send reset link' : 'Sign in'}
              </Button>

              <div className="auth-links">
                <Button variant="quiet" size="sm" onClick={() => switchMode(!showForgotPassword)}>
                  {showForgotPassword ? 'Back to sign in' : 'Forgot password?'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
