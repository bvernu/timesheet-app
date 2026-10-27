import { capitalize } from '../../utils/format';

// Status colours are FIXED (green / amber / blue / grey / red) and do not follow a company's brand
// colours, so "approved" never looks like a primary action and statuses read the same on every site.
const Pill = ({ tone = 'neutral', children, className = '' }) => (
  <span className={`pill pill-${tone} ${className}`}>{children}</span>
);

const PROJECT_TONES = {
  completed: 'success',
  invoiced: 'success',
  cancelled: 'neutral',
  'in progress': 'info',
  '40%': 'info',
  '50% completed': 'info',
  '60%': 'info',
  'quote sent': 'warning',
};

export const ProjectStatusBadge = ({ status }) => (
  <Pill tone={PROJECT_TONES[status] || 'neutral'}>{capitalize(status)}</Pill>
);

export const TypeChip = ({ type }) => <Pill tone="outline">{type}</Pill>;
export const RoleBadge = ({ role }) => <Pill tone="plain">{capitalize(role)}</Pill>;

// Time-entry state
export const EntryStatusBadge = ({ entry }) => {
  if (entry.approved) return <Pill tone="success">Approved</Pill>;
  if (!entry.clock_out) return <Pill tone="neutral">In progress</Pill>;
  return <Pill tone="warning">Pending</Pill>;
};

export default Pill;
