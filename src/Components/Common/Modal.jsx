import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';

// A centred dialog. Closes on Escape or a click on the dimmed background, locks page scrolling,
// and moves keyboard focus into the dialog while it is open.
const Modal = ({ title, onClose, children, footer, size = 'md', closeOnBackdrop = true }) => {
  const titleId = useId();
  const dialogRef = useRef(null);

  // Always call the latest onClose without re-running the set-up below on every render
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Runs ONCE when the dialog opens: lock scrolling, move focus in, listen for Escape.
  // (Running this on every render would steal focus back to the first field while someone types.)
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const firstField = dialog?.querySelector('input:not([type=hidden]), select, textarea');
    (firstField || dialog)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="ui-modal-backdrop" onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose?.()}>
      <div
        className={`ui-modal ui-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="ui-modal-header">
          <h3 id={titleId} className="ui-modal-title">{title}</h3>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer && <footer className="ui-modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
