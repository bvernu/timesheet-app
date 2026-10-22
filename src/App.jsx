import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthPage from './Components/Auth/AuthPage';
import EmployeeDashboard from './Components/Employee/EmployeeDashboard';
import ManagerDashboard from './Components/Manager/ManagerDashboard';
import SupervisorDashboard from './Components/Supervisor/SupervisorDashboard';
import ChangePasswordModal from './ChangePasswordModal';
import BrandLogo from './tenant/BrandLogo';
import { useTenant } from './tenant/TenantContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const tenant = useTenant();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loginNotice, setLoginNotice] = useState('');

  useEffect(() => {
    // Loads the signed-in user's profile and makes sure they belong to THIS site's company.
    const loadProfile = async (userId) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        // Check if user is deleted
        if (data.role === 'deleted') {
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        // Portal check: an account from another company cannot use this company's site.
        if (data.tenant_id !== tenant.id) {
          setLoginNotice("These login details can't be used on this site. Please sign in at your own company's web address.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        setProfile(data);
      }
      setLoading(false);
    };

    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [tenant.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage notice={loginNotice} onClearNotice={() => setLoginNotice('')} />;
  }

  if (!profile) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-light" style={{ backgroundColor: 'var(--brand-navbar-bg)', borderBottom: '3px solid var(--brand-primary)' }}>
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <BrandLogo />
          </span>
          <div className="d-flex align-items-center gap-2">
            <span className="me-3" style={{ color: 'var(--brand-navbar-text)', fontWeight: '500' }}>
              {profile.full_name}
            </span>
            <button 
              onClick={() => setShowChangePassword(true)}
              className="btn btn-sm btn-outline-secondary"
            >
              Change Password
            </button>
            <button 
              onClick={handleSignOut}
              className="btn btn-sm"
              style={{ 
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--brand-primary-contrast)',
                border: 'none'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      <div className="container-fluid py-4">
        {profile.role === 'supervisor' ? (
          <SupervisorDashboard profile={profile} />
        ) : profile.role === 'manager' ? (
          <ManagerDashboard profile={profile} />
        ) : (
          <EmployeeDashboard profile={profile} />
        )}
      </div>
    </div>
  );
}

export default App;
