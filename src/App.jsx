import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthPage from './Components/Auth/AuthPage';
import EmployeeDashboard from './Components/Employee/EmployeeDashboard';
import SupervisorDashboard from './Components/Supervisor/SupervisorDashboard';
import ChangePasswordModal from './ChangePasswordModal';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
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
  }, []);

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data);
    }
    setLoading(false);
  };

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
    return <AuthPage />;
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
          <div className="d-flex align-items-center gap-2">
            <span className="me-3" style={{ color: '#080808', fontWeight: '500' }}>
              {profile.full_name} ({profile.role})
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
                backgroundColor: '#F18F20',
                color: 'white',
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
        ) : (
          <EmployeeDashboard profile={profile} />
        )}
      </div>
    </div>
  );
}

export default App;