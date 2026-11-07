import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import { formatDate } from '../../utils/format';
import { useToast } from '../Common/Toast';

// <input type="datetime-local"> wants local time as "YYYY-MM-DDTHH:mm"
const toLocalInput = (iso) =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

const TimeEntryForm = ({ profile, projects, editingEntry, onClose, onSave }) => {
  const toast = useToast();
  const [projectId, setProjectId] = useState(editingEntry?.project_id || '');
  const [clockIn, setClockIn] = useState(toLocalInput(editingEntry?.clock_in));
  const [clockOut, setClockOut] = useState(toLocalInput(editingEntry?.clock_out));
  const [notes, setNotes] = useState(editingEntry?.notes || '');
  const [mileage, setMileage] = useState(editingEntry?.mileage || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Approved entries are locked
  if (editingEntry?.approved) {
    return (
      <Modal
        title="This entry can't be edited"
        onClose={onClose}
        size="sm"
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        <p className="mb-0">
          This entry was approved{editingEntry.approved_at ? ` on ${formatDate(editingEntry.approved_at)}` : ''} and is now locked.
        </p>
      </Modal>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectId || !clockIn) {
      setError('Project and clock-in time are required.');
      return;
    }
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Clock out must be after clock in.');
      return;
    }

    const entryData = {
      employee_id: profile.id,
      project_id: projectId,
      clock_in: new Date(clockIn).toISOString(),
      clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      notes: notes,
      mileage: mileage ? parseFloat(mileage) : null,
    };

    setSaving(true);
    try {
      const { error } = editingEntry
        ? await supabase.from('time_entries').update(entryData).eq('id', editingEntry.id)
        : await supabase.from('time_entries').insert([entryData]);
      if (error) throw error;

      toast.success(editingEntry ? 'Time entry updated' : 'Time entry added');
      onSave();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editingEntry ? 'Edit time entry' : 'Add time entry'}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="time-entry-form" loading={saving}>
            {editingEntry ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      <form id="time-entry-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="form-label" htmlFor="te-project">
            Project<span className="required-mark" aria-hidden="true"> *</span>
          </label>
          <select
            id="te-project"
            className="form-select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="field">
              <label className="form-label" htmlFor="te-in">
                Clock in<span className="required-mark" aria-hidden="true"> *</span>
              </label>
              <input
                id="te-in"
                type="datetime-local"
                className="form-control"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="field">
              <label className="form-label" htmlFor="te-out">Clock out</label>
              <input
                id="te-out"
                type="datetime-local"
                className="form-control"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label className="form-label" htmlFor="te-mileage">Mileage (km)</label>
          <input
            id="te-mileage"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            className="form-control"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="field">
          <label className="form-label" htmlFor="te-notes">Notes</label>
          <textarea
            id="te-notes"
            className="form-control"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-danger mb-0" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default TimeEntryForm;
