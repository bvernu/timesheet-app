const EmptyState = ({ title, children, action }) => (
  <div className="empty-state">
    <p className="empty-title">{title}</p>
    {children && <p className="empty-text">{children}</p>}
    {action}
  </div>
);

export default EmptyState;
