export const money = (value) => {
  const n = Number(value || 0);
  const text = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 && text !== '0.00' ? '-' : ''}$${text}`;
};

// Sum of numbers (text from the database is fine); empty values count as 0
export const sum = (rows, pick) => rows.reduce((t, r) => t + (Number(pick(r)) || 0), 0);

// Round to cents so 0.1 + 0.2 style drift never shows up as a balance of $0.0000001
export const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
