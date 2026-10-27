// Title (+ optional subtitle) on the left, the page's main action(s) on the right.
const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-header">
    <div className="page-header-text">
      <h2 className="page-title">{title}</h2>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export default PageHeader;
