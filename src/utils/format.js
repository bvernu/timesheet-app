// Shared formatting + time maths, so every screen shows dates, times and hours the same way.

// A plain date such as "2026-10-27" (from a date picker or a date column) means that calendar day
// where the PERSON is. `new Date("2026-10-27")` would instead mean midnight UTC, which is the previous
// evening in North America, and made "today" look like "yesterday". Parse these as LOCAL dates.
export const parseLocalDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
};

// Dates use the viewer's own locale and always spell the month ("Oct 20, 2026" / "20 oct. 2026"),
// so 10/11/2026 can never be misread as day-month vs month-day.
export const formatDate = (value) =>
  value ? parseLocalDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// How many calendar days after the clock-in day the clock-out falls (0 = same day).
export const dayOffset = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return 0;
  const ms = startOfDay(new Date(clockOut)) - startOfDay(new Date(clockIn));
  return Math.max(0, Math.round(ms / 86400000));
};

// Unpaid break rule used throughout the app.
export const calculateBreak = (hours) => {
  if (hours > 10) return 1.0;
  if (hours > 5) return 0.5;
  return 0;
};

// total / break / net hours for one time entry (all 0 while the entry is still open).
export const entryHours = (entry) => {
  if (!entry?.clock_out) return { total: 0, brk: 0, net: 0, open: true };
  const total = (new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000;
  const brk = calculateBreak(total);
  return { total, brk, net: total - brk, open: false };
};

export const hours = (n) => Number(n || 0).toFixed(2);

// Monday 00:00 of the week containing `date`.
export const startOfWeek = (date = new Date()) => {
  const d = startOfDay(date);
  const diff = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - diff);
  return d;
};

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export const initials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

// yyyy-mm-dd in local time (for date inputs and file names)
export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
