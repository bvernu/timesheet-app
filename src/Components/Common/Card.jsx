// A white panel with an optional title (and optional actions on the right of the title).
const Card = ({ title, actions, children, className = '', flush = false }) => (
  <section className={`card ${className}`}>
    {(title || actions) && (
      <header className="card-header">
        {title && <h3 className="card-title">{title}</h3>}
        {actions && <div className="card-actions">{actions}</div>}
      </header>
    )}
    <div className={`card-body${flush ? ' card-body-flush' : ''}`}>{children}</div>
  </section>
);

export default Card;
