import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';

const TimeEntryForm = ({ profile, projects, editingEntry, onClose, onSave }) => {
  if (editingEntry?.approved) {
    return (
      <Card title="Can not edit - Entry has been approved">
        <div className="alert alert-warning">
          <strong>This timesheet entry has been approved and cannot be edited</strong>
          <p className="mb-0 mt-2">
            Approved on: {new Date(editingEntry.approved_at).toLocaleDateString()}
          </p>
        </div>
        <Button onCLick={onClose} variant="secondary">Close</Button>
      </Card>
    );
  }
  
  const [projectId, setProjectId] = useState(editingEntry?.project_id || '');
  const [clockIn, setClockIn] = useState(
    editingEntry?.clock_in 
      ? new Date(new Date(editingEntry.clock_in).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : ''
  );
  const [clockOut, setClockOut] = useState(
    editingEntry?.clock_out 
      ? new Date(new Date(editingEntry.clock_out).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : ''
  );
  const [notes, setNotes] = useState(editingEntry?.notes || '');
  const [mileage, setMileage] = useState(editingEntry?.mileage || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectId || !clockIn) {
      setError('Project and Clock In time are required');
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

    try {
      if (editingEntry) {
        const { error } = await supabase
          .from('time_entries')
          .update(entryData)
          .eq('id', editingEntry.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_entries')
          .insert([entryData]);
        
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Card title={editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">
            Project <span className="text-danger">*</span>
          </label>
          <select
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
            <div className="mb-3">
              <label className="form-label">
                Clock In <span className="text-danger">*</span>
              </label>
              <input
                type="datetime-local"
                className="form-control"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Clock Out</label>
              <input
                type="datetime-local"
                className="form-control"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Mileage (km)</label>
          <input
            type="number"
            step="0.1"
            className="form-control"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <div className="d-flex gap-2">
          <Button type="submit" variant="primary">
            {editingEntry ? 'Update' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default TimeEntryForm;