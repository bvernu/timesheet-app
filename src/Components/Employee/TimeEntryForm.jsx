import { useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import { entryHours, formatDate } from '../../utils/format';
import { formatDuration, parseDuration, splitEvenly } from '../../utils/duration';
import { useToast } from '../Common/Toast';
import { useTenantSettings } from '../../tenant/settings';
import { entryProjects } from '../../utils/entryProjects';

// <input type="datetime-local"> wants local time as "YYYY-MM-DDTHH:mm"
const toLocalInput = (iso) =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

const TimeEntryForm = ({ profile, projects, editingEntry, onClose, onSave }) => {
  const toast = useToast();
  const { projectField, mileageField, multiProject, projectHours, autoBreak } = useTenantSettings();
  const [projectId, setProjectId] = useState(editingEntry?.project_id || '');
  // several-projects mode: the ids ticked in the list
  const [projectIds, setProjectIds] = useState(() => new Set(entryProjects(editingEntry).map((p) => p.id)));
  const [projectFilter, setProjectFilter] = useState('');
  // Time per project. Boxes the person has typed in ("touched") keep their text; every other box is filled in
  // automatically with an even share of whatever time is still unassigned.
  const storedMinutes = useMemo(
    () => Object.fromEntries(entryProjects(editingEntry).filter((p) => p.minutes).map((p) => [p.id, p.minutes])),
    [editingEntry]
  );
  const [activeId, setActiveId] = useState(null);   // the project box the person touched last
  const [touched, setTouched] = useState(() => new Set(Object.keys(storedMinutes)));
  const [hoursText, setHoursText] = useState(() =>
    Object.fromEntries(Object.entries(storedMinutes).map(([id, m]) => [id, formatDuration(m)]))
  );
  const [clockIn, setClockIn] = useState(toLocalInput(editingEntry?.clock_in));
  const [clockOut, setClockOut] = useState(toLocalInput(editingEntry?.clock_out));
  const [notes, setNotes] = useState(editingEntry?.notes || '');
  const [mileage, setMileage] = useState(editingEntry?.mileage || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // How much time the entry covers (what the tables call "Hours"), in whole minutes. null until clock out is filled in.
  const totalMinutes = useMemo(() => {
    if (!clockIn || !clockOut) return null;
    const entry = { clock_in: new Date(clockIn).toISOString(), clock_out: new Date(clockOut).toISOString() };
    if (new Date(clockOut) <= new Date(clockIn)) return null;
    return Math.round(entryHours(entry, autoBreak).net * 60);
  }, [clockIn, clockOut, autoBreak]);

  const selectedIds = useMemo(() => projects.filter((p) => projectIds.has(p.id)).map((p) => p.id), [projects, projectIds]);
  // a project that was on the entry but isn't in the list any more (archived) stays in the entry
  const allSelectedIds = useMemo(() => [...selectedIds, ...[...projectIds].filter((id) => !selectedIds.includes(id))], [selectedIds, projectIds]);
  const nameOf = (id) => projects.find((p) => p.id === id)?.name || entryProjects(editingEntry).find((p) => p.id === id)?.name || 'Project';

  const showHours = multiProject && projectHours && allSelectedIds.length > 1 && totalMinutes !== null;

  // Automatic boxes: an even share of the time not claimed by the boxes the person typed in
  const autoMinutes = useMemo(() => {
    if (totalMinutes === null) return {};
    const auto = allSelectedIds.filter((id) => !touched.has(id));
    const claimed = allSelectedIds.reduce((t, id) => t + (touched.has(id) ? parseDuration(hoursText[id]) || 0 : 0), 0);
    const parts = splitEvenly(Math.max(0, totalMinutes - claimed), auto.length);
    return Object.fromEntries(auto.map((id, i) => [id, parts[i]]));
  }, [totalMinutes, allSelectedIds, touched, hoursText]);

  const minutesOf = (id) => (touched.has(id) ? parseDuration(hoursText[id]) : autoMinutes[id] ?? null);
  const textOf = (id) => (touched.has(id) ? hoursText[id] ?? '' : formatDuration(autoMinutes[id] ?? 0));
  const allocated = allSelectedIds.reduce((t, id) => t + (minutesOf(id) || 0), 0);
  const remaining = totalMinutes === null ? 0 : totalMinutes - allocated;

  const setProjectText = (id, text) => {
    setTouched((prev) => new Set(prev).add(id));
    setHoursText((prev) => ({ ...prev, [id]: text }));
  };
  const fillRemaining = (id) => {
    setTouched((prev) => new Set(prev).add(id));
    setHoursText((prev) => ({ ...prev, [id]: formatDuration(Math.max(0, (minutesOf(id) || 0) + remaining)) }));
  };

  const visibleProjects = useMemo(() => {
    const q = projectFilter.trim().toLowerCase();
    return q ? projects.filter((p) => (p.name || '').toLowerCase().includes(q) || String(p.serial_number || '').includes(q)) : projects;
  }, [projects, projectFilter]);

  const toggleProject = (id) =>
    setProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

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

    if (multiProject && projectIds.size === 0) {
      setError('Select at least one project.');
      return;
    }
    if ((projectField && !multiProject && !projectId) || !clockIn) {
      setError(projectField ? 'Project and clock-in time are required.' : 'Clock-in time is required.');
      return;
    }
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Clock out must be after clock in.');
      return;
    }

    // Hours per project: every project needs a time, and together they must add up to the time worked
    let projectMinutes = null;
    if (multiProject && projectHours) {
      if (allSelectedIds.length === 1 && totalMinutes !== null) {
        projectMinutes = [totalMinutes];                       // one project gets all the time
      } else if (showHours) {
        const missing = allSelectedIds.find((id) => !(minutesOf(id) > 0));
        if (missing) {
          setError(`Enter how long you spent on ${nameOf(missing)}.`);
          return;
        }
        if (remaining !== 0) {
          setError(remaining > 0
            ? `${formatDuration(remaining)} of the ${formatDuration(totalMinutes)} is not assigned to a project yet.`
            : `The project times are ${formatDuration(-remaining)} more than the ${formatDuration(totalMinutes)} worked.`);
          return;
        }
        projectMinutes = allSelectedIds.map((id) => minutesOf(id));
      }
    }

    if (multiProject) {
      // The entry and its projects are saved together in one database step, so it can never end up half saved.
      setSaving(true);
      const { error } = await supabase.rpc('save_time_entry', {
        p_entry_id: editingEntry?.id ?? null,
        p_clock_in: new Date(clockIn).toISOString(),
        p_clock_out: clockOut ? new Date(clockOut).toISOString() : null,
        p_notes: notes,
        p_mileage: mileageField && mileage ? parseFloat(mileage) : null,
        p_set_mileage: !!mileageField,
        p_project_ids: allSelectedIds,
        ...(projectHours ? { p_project_minutes: projectMinutes ? projectMinutes : null } : {}),
      });
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      toast.success(editingEntry ? 'Time entry updated' : 'Time entry added');
      onSave();
      return;
    }

    const entryData = {
      employee_id: profile.id,
      clock_in: new Date(clockIn).toISOString(),
      clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      notes: notes,
    };
    // A field this company has switched off is left out entirely, so editing an entry never wipes a value saved earlier.
    if (projectField) entryData.project_id = projectId;
    if (mileageField) entryData.mileage = mileage ? parseFloat(mileage) : null;

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
        {projectField && multiProject && (
          <fieldset className="field project-picker">
            <legend className="form-label">
              Projects<span className="required-mark" aria-hidden="true"> *</span>
              <span className="field-help d-inline ms-2">{projectIds.size} selected{projectHours ? '' : ' · hours are split equally'}</span>
            </legend>
            <input
              type="search"
              className="form-control mb-2"
              placeholder="Search projects…"
              aria-label="Search projects"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            />
            <div className="check-list" role="group" aria-label="Projects">
              {visibleProjects.length === 0 && <p className="text-muted small mb-0 p-2">No projects match.</p>}
              {visibleProjects.map((project) => (
                <label key={project.id} className="check-list-item">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={projectIds.has(project.id)}
                    onChange={() => toggleProject(project.id)}
                  />
                  <span>{project.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {projectField && !multiProject && (
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
        )}

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


        {multiProject && projectHours && allSelectedIds.length > 1 && (
          <section className="field project-hours" aria-labelledby="ph-title">
            <div className="project-hours-head">
              <h3 id="ph-title" className="project-hours-title">Time on each project</h3>
              {showHours && (
                <Button variant="quiet" size="sm" onClick={() => setTouched(new Set())} disabled={touched.size === 0}>
                  Split evenly
                </Button>
              )}
            </div>

            {!showHours ? (
              <p className="field-help mb-0">
                Fill in the clock in and clock out times, then divide the time between your projects here. Until then it is split evenly.
              </p>
            ) : (
              <>
                <ul className="project-hours-list">
                  {allSelectedIds.map((id) => (
                    <li key={id} className="project-hours-row">
                      <label htmlFor={`ph-${id}`} className="project-hours-name">{nameOf(id)}</label>
                      {remaining > 0 && activeId === id && touched.has(id) && (
                        <button type="button" className="btn-link-inline small" onClick={() => fillRemaining(id)} title="Add the unassigned time to this project">
                          + {formatDuration(remaining)}
                        </button>
                      )}
                      <input
                        id={`ph-${id}`}
                        className="form-control project-hours-input"
                        inputMode="text"
                        autoComplete="off"
                        placeholder="e.g. 2h 30m"
                        value={textOf(id)}
                        onFocus={() => setActiveId(id)}
                        onChange={(e) => setProjectText(id, e.target.value)}
                        onBlur={() => {
                          const m = minutesOf(id);
                          if (touched.has(id) && m !== null) setHoursText((prev) => ({ ...prev, [id]: formatDuration(m) }));
                        }}
                        aria-invalid={touched.has(id) && hoursText[id] ? minutesOf(id) === null : undefined}
                      />
                    </li>
                  ))}
                </ul>
                <p className={`project-hours-total ${remaining === 0 ? 'is-ok' : remaining < 0 ? 'is-over' : 'is-left'}`} role="status">
                  {remaining === 0
                    ? `✓ All ${formatDuration(totalMinutes)} assigned`
                    : remaining > 0
                      ? `${formatDuration(remaining)} left to assign · ${formatDuration(allocated)} of ${formatDuration(totalMinutes)}`
                      : `${formatDuration(-remaining)} too much · ${formatDuration(allocated)} of ${formatDuration(totalMinutes)}`}
                </p>
                <p className="field-help mb-0">Type hours or hours and minutes: 2.5, 2:30 or 2h 30m.</p>
              </>
            )}
          </section>
        )}

        {mileageField && (
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
        )}

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
