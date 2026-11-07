import { useEffect, useRef, useState } from 'react';
import { initials } from '../../utils/format';

// Top-bar account menu: name + avatar, with "Change password" and "Sign out" inside.
const UserMenu = ({ name, subtitle, onChangePassword, onSignOut }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={rootRef}>
      <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initials(name)}</span>
        <span className="user-menu-name">{name}</span>
        <span className="user-menu-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="user-menu-list" role="menu">
          <div className="user-menu-heading">
            {name}
            {subtitle && <div className="user-menu-subtitle">{subtitle}</div>}
          </div>
          <button type="button" role="menuitem" className="row-menu-item" onClick={() => { setOpen(false); onChangePassword(); }}>
            Change password
          </button>
          <button type="button" role="menuitem" className="row-menu-item" onClick={() => { setOpen(false); onSignOut(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
