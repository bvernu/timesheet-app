// Grey shimmering placeholder lines shown while a table is loading.
const Skeleton = ({ rows = 4 }) => (
  <div className="skeleton-rows" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => (
      <span key={i} className="skeleton" style={{ width: `${92 - (i % 3) * 14}%` }} />
    ))}
  </div>
);

export default Skeleton;
