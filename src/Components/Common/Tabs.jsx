// Page-level navigation: underlined tabs. Only the active tab's content is rendered.
const Tabs = ({ tabs, activeTab, onTabChange }) => (
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

export default Tabs;
