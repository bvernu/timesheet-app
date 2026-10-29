import { useState } from 'react';
import Drawer from './Drawer';
import { useMediaQuery } from '../../utils/useMediaQuery';

// Page-level navigation between the sections of a dashboard. Only the active section's content is rendered.
//  - Desktop: underlined tabs.
//  - Phone:   a bar showing the current section with a menu button, which opens a side menu listing every section
//             (no sideways-scrolling tab strip).
const Tabs = ({ tabs, activeTab, onTabChange }) => {
  const isPhone = useMediaQuery('(max-width: 767.98px)');
  const [menuOpen, setMenuOpen] = useState(false);
  const active = tabs.find((t) => t.id === activeTab) || tabs[0];

  if (isPhone) {
    return (
      <div>
        <div className="section-bar">
          <button
            type="button"
            className="section-button"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
            <span className="section-current">{active.label}</span>
            <span className="section-menu-label">Menu</span>
          </button>
        </div>

        {menuOpen && (
          <Drawer title="Menu" onClose={() => setMenuOpen(false)}>
            <nav aria-label="Sections">
              <ul className="drawer-nav">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      type="button"
                      className={`drawer-link${tab.id === active.id ? ' active' : ''}`}
                      aria-current={tab.id === active.id ? 'page' : undefined}
                      onClick={() => {
                        onTabChange(tab.id);
                        setMenuOpen(false);
                      }}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </Drawer>
        )}

        <div className="tab-panel">{active.content}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab-link${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) =>
        activeTab === tab.id ? (
          <div key={tab.id} id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} className="tab-panel">
            {tab.content}
          </div>
        ) : null
      )}
    </div>
  );
};

export default Tabs;
