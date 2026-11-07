import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthPage from './Components/Auth/AuthPage';
import EmployeeDashboard from './Components/Employee/EmployeeDashboard';
import ManagerDashboard from './Components/Manager/ManagerDashboard';
import SupervisorDashboard from './Components/Supervisor/SupervisorDashboard';
import ChangePasswordModal from './ChangePasswordModal';
import UserMenu from './Components/Common/UserMenu';
import BrandLogo from './tenant/BrandLogo';
import { useTenant } from './tenant/TenantContext';
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
        <div className="spinner-border text-secondary" role="status">
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
          <div className="spinner-border text-secondary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <BrandLogo />
          </div>
          <UserMenu
            name={profile.full_name}
            subtitle={`${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)} · ${tenant.name}`}
            onChangePassword={() => setShowChangePassword(true)}
            onSignOut={handleSignOut}
          />
        </div>
      </header>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      <main className="page-container">
        {profile.role === 'supervisor' ? (
          <SupervisorDashboard profile={profile} />
        ) : profile.role === 'manager' ? (
          <ManagerDashboard profile={profile} />
        ) : (
          <EmployeeDashboard profile={profile} />
        )}
      </main>
    </div>
  );
}

export default App;
