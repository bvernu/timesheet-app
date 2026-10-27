import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The "⋯" menu at the end of a table row.
//   items: [{ label, onClick, danger?: boolean, hidden?: boolean }]
// The list is drawn on top of the page (not inside the table), so scrolling tables never clip it.
const RowMenu = ({ items, label = 'Row actions' }) => {
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const visible = items.filter((i) => !i.hidden);

  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') { close(); buttonRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  useEffect(() => {
    if (pos) menuRef.current?.querySelector('button')?.focus();
  }, [pos]);

  if (visible.length === 0) return null;

  const toggle = (e) => {
    e.stopPropagation();
    if (pos) return close();
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 180;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const opensUp = rect.bottom + visible.length * 40 + 16 > window.innerHeight;
    setPos({ left, top: opensUp ? undefined : rect.bottom + 4, bottom: opensUp ? window.innerHeight - rect.top + 4 : undefined });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="row-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={toggle}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {pos && createPortal(
        <div ref={menuRef} className="row-menu" role="menu" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}>
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`row-menu-item${item.danger ? ' danger' : ''}`}
              onClick={(e) => { e.stopPropagation(); close(); item.onClick(); }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default RowMenu;
