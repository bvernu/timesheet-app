// Title (+ optional subtitle) on the left, the page's main action(s) on the right.
// hideTitleOnPhone: on phones the section bar above already names the page, so the title is dropped to save space.
const PageHeader = ({ title, subtitle, actions, hideTitleOnPhone = false }) => (
  <div className={`page-header${hideTitleOnPhone ? ' title-hidden-phone' : ''}`}>
    <div className="page-header-text">
      <h2 className="page-title">{title}</h2>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export default PageHeader;
