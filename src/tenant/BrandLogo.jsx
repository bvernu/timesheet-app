import { useState } from 'react';
import { useTenant } from './TenantContext';

// The company logo for the current site, falling back to the company name if there is no logo.
const BrandLogo = ({ height = 36, className = '' }) => {
  const tenant = useTenant();
  const [failed, setFailed] = useState(false);

  if (!tenant.logo_url || failed) {
    return <span className={className} style={{ fontWeight: 700, color: 'var(--brand-navbar-text)' }}>{tenant.name}</span>;
  }
  return (
    <img
      src={tenant.logo_url}
      alt={`${tenant.name} logo`}
      height={height}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

export default BrandLogo;
