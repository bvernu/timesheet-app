import { useState } from 'react';
import Button from '../Common/Button';

// "Add a supplier" drop-down listing the company's suppliers that are not chosen yet, plus "New supplier…" to type a
// name that isn't in the list. Picking one calls onPick(supplier). The chosen ones are shown by the parent.
const SupplierPicker = ({ idPrefix = 'sp', suppliers, excludeIds = [], onPick, onCreate, label = 'Add a supplier', disabled = false }) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const available = suppliers.filter((s) => !excludeIds.includes(s.id));

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === '__new') { setCreating(true); return; }
    const s = suppliers.find((x) => x.id === v);
    if (s) onPick(s);
  };

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      const s = await onCreate(name);
      if (excludeIds.includes(s.id)) setError(`${s.name} is already added.`);
      else { onPick(s); setName(''); setCreating(false); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="supplier-picker">
      <label className="form-label" htmlFor={`${idPrefix}-select`}>{label}</label>
      <select id={`${idPrefix}-select`} className="form-select" value="" onChange={handleSelect} disabled={disabled}>
        <option value="">{available.length ? 'Choose a supplier…' : 'No more suppliers in the list'}</option>
        {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value="__new">+ New supplier…</option>
      </select>
      {creating && (
        <div className="supplier-new">
          <label className="form-label" htmlFor={`${idPrefix}-new`}>New supplier name</label>
          <div className="d-flex gap-2">
            <input
              id={`${idPrefix}-new`}
              className="form-control"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
            />
            <Button onClick={create} loading={busy} disabled={!name.trim()}>Add</Button>
            <Button variant="secondary" onClick={() => { setCreating(false); setName(''); setError(''); }} disabled={busy}>Cancel</Button>
          </div>
          {error && <div className="text-danger small mt-1" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
};

export default SupplierPicker;
