import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';

// A panel that slides in from the left (used for the phone navigation menu).
// Closes on Escape or a tap on the dimmed background; focus moves into the panel while it is open.
const Drawer = ({ title, onClose, children }) => {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panelRef}>
        <div className="drawer-header">
          <h3 id={titleId} className="drawer-title">{title}</h3>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close menu">×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Drawer;
