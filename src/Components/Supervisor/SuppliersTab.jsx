import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import PageHeader from '../Common/PageHeader';
import RowMenu from '../Common/RowMenu';
import EmptyState from '../Common/EmptyState';
import Skeleton from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import { useToast } from '../Common/Toast';
import { useSuppliers } from '../Procurement/useSuppliers';

// The company's supplier list. For now a supplier is only a name; the order details live on each project.
const SuppliersTab = () => {
  const toast = useToast();
  const { suppliers, loading, error, reload, addSupplier } = useSuppliers();
  const [editing, setEditing] = useState(null);   // {} new | supplier
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const open = (s) => { setEditing(s); setName(s.name || ''); setFormError(''); };

  const save = async (e) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setFormError('Enter a supplier name.');
    setSaving(true);
    try {
      if (editing.id) {
        const { error: err } = await supabase.from('suppliers').update({ name: clean }).eq('id', editing.id);
        if (err) throw err;
      } else {
        await addSupplier(clean);
      }
      toast.success(editing.id ? 'Supplier renamed' : 'Supplier added');
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(/duplicate key/i.test(err.message) ? 'A supplier with that name already exists.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    const { error: err } = await supabase.from('suppliers').delete().eq('id', deleting.id);
    setBusy(false);
    if (err) {
      toast.error(/foreign key/i.test(err.message)
        ? `${deleting.name} is still on one or more projects. Remove it from those projects first.`
        : `Couldn't delete: ${err.message}`);
    } else {
      toast.success('Supplier deleted');
      reload();
    }
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader title="Suppliers" hideTitleOnPhone actions={<Button onClick={() => open({})}>Add supplier</Button>} />
      <Card flush>
        {loading ? <Skeleton rows={4} /> : error ? (
          <EmptyState title="Couldn't load suppliers">{error}</EmptyState>
        ) : suppliers.length === 0 ? (
          <EmptyState title="No suppliers yet" action={<Button onClick={() => open({})}>Add your first supplier</Button>}>
            Suppliers you add here can be picked when you create a project or add a supplier to one.
          </EmptyState>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead><tr><th>Name</th><th aria-label="Actions"></th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-strong">{s.name}</td>
                    <td className="cell-actions">
                      <RowMenu label={`Actions for ${s.name}`} items={[
                        { label: 'Rename', onClick: () => open(s) },
                        { label: 'Delete', danger: true, onClick: () => setDeleting(s) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Modal
          title={editing.id ? 'Rename supplier' : 'Add supplier'}
          size="sm"
          onClose={saving ? undefined : () => setEditing(null)}
          footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button type="submit" form="supplier-form" loading={saving}>Save</Button></>}
        >
          <form id="supplier-form" onSubmit={save} noValidate>
            <div className="field">
              <label className="form-label" htmlFor="sup-name">Supplier name<span className="required-mark" aria-hidden="true"> *</span></label>
              <input id="sup-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {formError && <div className="alert alert-danger mb-0" role="alert">{formError}</div>}
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Delete this supplier?" tone="danger" confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDeleting(null)}>
          <p><strong>{deleting.name}</strong> will be removed from your supplier list. A supplier that is still on a project can&apos;t be deleted.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default SuppliersTab;
