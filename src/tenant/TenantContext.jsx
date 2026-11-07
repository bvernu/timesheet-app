import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { applyTheme } from './theme';

const TenantContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useTenant = () => {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error('useTenant must be used inside <TenantProvider>');
  return tenant;
};

// Which hostname decides the company?  In production: always the address in the browser.
// While developing locally (npm run dev only - this code is removed from production builds) you can
// pretend to be another company:  http://localhost:5173/?host=acmetimesheet-staging.vercel.app
// or set VITE_DEV_TENANT_HOST in .env.local.
// eslint-disable-next-line react-refresh/only-export-components
export function resolveHostname() {
  if (import.meta.env.DEV) {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('host');
      if (fromQuery) window.sessionStorage.setItem('devTenantHost', fromQuery);
      const remembered = window.sessionStorage.getItem('devTenantHost');
      const override = fromQuery || remembered || import.meta.env.VITE_DEV_TENANT_HOST;
      if (override) return override.trim().toLowerCase();
    } catch {
      /* storage unavailable - fall through to the real hostname */
    }
  }
  return window.location.hostname.toLowerCase();
}

function setFavicon(href) {
  if (!href) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.removeAttribute('type');
  link.href = href;
}

const CenteredMessage = ({ title, children }) => (
  <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
    <div className="text-center" style={{ maxWidth: 420 }}>
      <h4 className="mb-3">{title}</h4>
      {children}
    </div>
  </div>
);

export function TenantProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', tenant: null });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: 'loading', tenant: null });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = resolveHostname();

    supabase.rpc('get_tenant_by_host', { p_host: host }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('Tenant lookup failed:', error);
        setState({ status: 'error', tenant: null });
        return;
      }
      const tenant = Array.isArray(data) ? data[0] : data;
      if (!tenant) {
        setState({ status: 'unknown', tenant: null });
        return;
      }
      applyTheme(tenant.theme);
      document.title = `${tenant.name} Timesheet`;
      setFavicon(tenant.favicon_url || tenant.logo_url);
      setState({ status: 'ready', tenant });
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-secondary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (state.status === 'unknown') {
    return (
      <CenteredMessage title="Site not found">
        <p className="text-muted">This web address isn&apos;t set up for a timesheet. Please check the link you were given.</p>
      </CenteredMessage>
    );
  }

  if (state.status === 'error') {
    return (
      <CenteredMessage title="Can't load this site">
        <p className="text-muted">We couldn&apos;t reach the server. Check your connection and try again.</p>
        <button className="btn btn-secondary" onClick={retry}>Try again</button>
      </CenteredMessage>
    );
  }

  return <TenantContext.Provider value={state.tenant}>{children}</TenantContext.Provider>;
}
