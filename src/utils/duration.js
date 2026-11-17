// Small helpers for typing and showing "how long" as minutes.

// Understands what people actually type: 2.5  2,5  2:30  2h  2h30  2h 30m  90m  1 h 15 min  0:45
// Returns whole minutes, or null when it can't be read (blank included).
export function parseDuration(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  let m;
  if ((m = t.match(/^(\d+):([0-5]?\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = t.match(/^(\d+)\s*h\s*(\d+)$/))) return Number(m[1]) * 60 + Number(m[2]);   // 2h30
  if ((m = t.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/)) && (m[1] || m[2])) {
    return Math.round(Number(m[1] || 0) * 60) + Number(m[2] || 0);
  }
  if ((m = t.match(/^(\d+(?:\.\d+)?)$/))) return Math.round(Number(m[1]) * 60);  // a bare number means hours
  return null;
}

// 150 -> "2h 30m", 120 -> "2h", 45 -> "45m", 0 -> "0m"
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Splits `total` minutes between n projects as evenly as whole minutes allow; the pieces always add up to `total`.
export function splitEvenly(total, n) {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}
