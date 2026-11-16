// Order status for one supplier on one project, in the order an order normally moves through them.
export const ORDER_STATUSES = [
  'quote requested',
  'quote received',
  'order issued',
  'ordered',
  'in transit',
  'delivered',
  'delivered to carmen warehouse',
];

export const statusLabel = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export const EMPTY_ORDER = {
  location: '',
  items: '',
  invoice_amount: '',
  order_number: '',
  status: 'quote requested',
  lead_time: '',
  order_date: '',
  ship_to: '',
  tracking: '',
};

// Form values -> a database row (empty text becomes null; amount becomes a number)
export const orderToRow = (o) => ({
  location: o.location.trim(),
  items: o.items.trim(),
  invoice_amount: o.invoice_amount === '' || o.invoice_amount === null ? null : Number(o.invoice_amount),
  order_number: o.order_number?.trim() || null,
  status: o.status || 'quote requested',
  lead_time: o.lead_time?.trim() || null,
  order_date: o.order_date || null,
  ship_to: o.ship_to?.trim() || null,
  tracking: o.tracking?.trim() || null,
});

// Required when a supplier is added to a project: item(s) and location. Returns a message or ''.
export const validateOrder = (o, supplierName = 'this supplier') => {
  if (!o.items?.trim()) return `Items are required for ${supplierName}.`;
  if (!o.location?.trim()) return `Location is required for ${supplierName}.`;
  if (o.invoice_amount !== '' && o.invoice_amount !== null && !(Number(o.invoice_amount) >= 0)) {
    return `Invoice amount for ${supplierName} must be a number of 0 or more.`;
  }
  return '';
};
