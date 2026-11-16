import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

// The company's supplier list (name only for now), kept sorted by name.
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from('suppliers').select('id, name').order('name');
    if (err) setError(err.message);
    else { setSuppliers(data || []); setError(''); }
    setLoading(false);
  }, []);

  // Loading data when the screen opens: the state update happens after the request returns
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  // Adds a supplier, or returns the one that already has that name (names are unique per company, ignoring case).
  const addSupplier = useCallback(async (rawName) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Enter a supplier name.');
    const existing = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const { data, error: err } = await supabase.from('suppliers').insert([{ name }]).select('id, name').single();
    if (err) throw err;
    setSuppliers((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  }, [suppliers]);

  return { suppliers, loading, error, reload, addSupplier };
}
