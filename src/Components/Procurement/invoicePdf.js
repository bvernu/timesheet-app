import { supabase } from '../../supabaseClient';

const BUCKET = 'supplier-invoices';
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export const checkPdf = (file) => {
  if (!file) return '';
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!looksPdf) return 'The invoice must be a PDF file.';
  if (file.size > MAX_PDF_BYTES) return 'The PDF is too large (15 MB maximum).';
  return '';
};

const safeName = (name) => (name || 'invoice.pdf').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);

// Path is <company id>/<project id>/<order id>-<file name>. The first folder must be the company id: the database
// only lets people from that company read or write it.
export async function uploadInvoicePdf({ tenantId, projectId, orderId, file }) {
  const path = `${tenantId}/${projectId}/${orderId}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
  return path;
}

export async function removeInvoicePdf(path) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

// The bucket is private, so opening a PDF uses a short-lived link made for the signed-in person
export async function openInvoicePdf(path) {
  // Open the tab first (inside the click) so pop-up blockers allow it, then point it at the link.
  const tab = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    tab?.close();
    throw error || new Error('Could not open the PDF.');
  }
  if (tab) tab.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

export const pdfFileName = (path) => (path ? path.split('/').pop().replace(/^[0-9a-f-]{36}-/, '') : '');
