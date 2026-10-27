// Builds a CSV (Excel-friendly) from an array of rows and downloads it.
const escapeCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Guard against spreadsheet formula injection from user-typed notes
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (rows) => rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');

export const downloadCsv = (filename, rows) => {
  const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
