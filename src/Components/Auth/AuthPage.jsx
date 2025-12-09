import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import InputField from '../Common/InputField';
import Button from '../Common/Button';

const AuthPage = () => {
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
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

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light" style={{ backgroundColor: '#E8E8E8', borderBottom: '3px solid #F18F20' }}>
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <img 
              src="/logo.png" 
              alt="Company Logo" 
              height="40"
              className="me-2"
            />
          </span>
          <span style={{ color: '#080808', fontSize: '1.5rem', fontWeight: '600' }}>
            Timesheet
          </span>
        </div>
      </nav>

      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="w-100" style={{ maxWidth: '400px' }}>
          <Card title={showForgotPassword ? 'Reset Password' : 'Sign In'}>
            <form onSubmit={showForgotPassword ? handleForgotPassword : handleAuth}>
              <InputField
                label="Email"
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                required
              />
              
              {!showForgotPassword && (
                <InputField
                  label="Password"
                  id="password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                />
              )}

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {message && (
                <div className="alert alert-success" role="alert">
                  {message}
                </div>
              )}

              <div className="d-grid gap-2">
                <Button type="submit" variant="primary">
                  {loading ? 'Loading...' : showForgotPassword ? 'Send Reset Email' : 'Sign In'}
                </Button>
              </div>
            </form>

            <div className="text-center mt-3">
              {!showForgotPassword && (
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="btn btn-link btn-sm"
                >
                  Forgot Password?
                </button>
              )}
              
              {showForgotPassword && (
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="btn btn-link"
                >
                  Back to Sign In
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;