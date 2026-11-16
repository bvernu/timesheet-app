import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { cents, sum } from '../../utils/money';

// Everything money-related for one project: supplier orders, client invoices and their payments, plus the totals.
//   profit = total invoiced to the client - total of the supplier invoices
//   balance of one invoice = its amount - the payments made against it
export function useProjectFinance(projectId, enabled = true) {
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) return;
    const [o, i] = await Promise.all([
      supabase.from('project_suppliers').select('*, suppliers (name)').eq('project_id', projectId).order('created_at'),
      supabase.from('client_invoices').select('*').eq('project_id', projectId).order('sent_date', { ascending: true, nullsFirst: false }),
    ]);
    const firstError = o.error || i.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const invoiceIds = (i.data || []).map((x) => x.id);
    let pay = [];
    if (invoiceIds.length > 0) {
      const p = await supabase.from('client_payments').select('*').in('invoice_id', invoiceIds).order('payment_date');
      if (p.error) { setError(p.error.message); setLoading(false); return; }
      pay = p.data || [];
    }
    setOrders(o.data || []);
    setInvoices(i.data || []);
    setPayments(pay);
    setError('');
    setLoading(false);
  }, [projectId, enabled]);

  // Loading data when the screen opens: the state update happens after the request returns
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  const supplierTotal = cents(sum(orders, (r) => r.invoice_amount));
  const clientTotal = cents(sum(invoices, (r) => r.amount));
  const paidTotal = cents(sum(payments, (r) => r.amount));
  const balanceOf = (invoice) => cents(Number(invoice.amount) - sum(payments.filter((p) => p.invoice_id === invoice.id), (p) => p.amount));

  return {
    orders, invoices, payments, loading, error, reload, balanceOf,
    totals: { supplier: supplierTotal, client: clientTotal, paid: paidTotal, outstanding: cents(clientTotal - paidTotal), profit: cents(clientTotal - supplierTotal) },
  };
}
