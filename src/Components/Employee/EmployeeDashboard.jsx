import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import RowMenu from '../Common/RowMenu';
import EmptyState from '../Common/EmptyState';
import Skeleton from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import { EntryStatusBadge } from '../Common/StatusBadge';
import { useToast } from '../Common/Toast';
import TimeEntryForm from './TimeEntryForm';
import { dayOffset, entryHours, formatDate, formatTime, hours, startOfWeek } from '../../utils/format';

const EmployeeDashboard = ({ profile }) => {
  const toast = useToast();
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    loadTimeEntries();
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTimeEntries = async () => {
    const { data } = await supabase
      .from('time_entries')
      .select(`
        *,
        projects (name)
      `)
      .eq('employee_id', profile.id)
      .order('clock_in', { ascending: false });

    if (data) {
      setTimeEntries(data);
    }
    setLoading(false);
  };

  // Archived projects are hidden from the picker
  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .is('archived_at', null)
      .order('name');

    if (data) {
      setProjects(data);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    const { error } = await supabase.from('time_entries').delete().eq('id', deletingEntry.id);
    setDeleteBusy(false);
    setDeletingEntry(null);
    if (error) {
      toast.error(`Couldn't delete the entry: ${error.message}`);
      return;
    }
    toast.success('Time entry deleted');
    loadTimeEntries();
  };

  // Editing an old entry whose project has since been archived: keep that project selectable
  const projectOptions = useMemo(() => {
    if (editingEntry && !projects.some((p) => p.id === editingEntry.project_id)) {
      return [...projects, { id: editingEntry.project_id, name: editingEntry.projects?.name || 'Archived project' }];
    }
    return projects;
  }, [projects, editingEntry]);

  const summary = useMemo(() => {
    const weekStart = startOfWeek();
    let weekNet = 0;
    let pending = 0;
    let approvedThisWeek = 0;
    timeEntries.forEach((entry) => {
      const { net, open } = entryHours(entry);
      const inWeek = new Date(entry.clock_in) >= weekStart;
      if (inWeek && !open) weekNet += net;
      if (!entry.approved && !open) pending += 1;
      if (entry.approved && inWeek) approvedThisWeek += 1;
    });
    return { weekNet, pending, approvedThisWeek };
  }, [timeEntries]);

  const openAdd = () => {
    setEditingEntry(null);
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingEntry(null);
  };

  return (
    <div>
      <PageHeader
        title="My timesheet"
        actions={<Button onClick={openAdd}>Add time entry</Button>}
      />

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">This week</div>
          <div className="stat-value">{hours(summary.weekNet)}<span className="stat-unit">h</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Awaiting approval</div>
          <div className="stat-value">{summary.pending}<span className="stat-unit">{summary.pending === 1 ? 'entry' : 'entries'}</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Approved this week</div>
          <div className="stat-value">{summary.approvedThisWeek}<span className="stat-unit">{summary.approvedThisWeek === 1 ? 'entry' : 'entries'}</span></div>
        </div>
      </div>

      <Card flush>
        {loading ? (
          <Skeleton />
        ) : timeEntries.length === 0 ? (
          <EmptyState
            title="No time entries yet"
            action={<Button onClick={openAdd}>Add your first entry</Button>}
          >
            Log your hours and they&apos;ll show up here for approval.
          </EmptyState>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-stack">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th className="num hide-mobile">Total (h)</th>
                  <th className="num hide-mobile">Break (h)</th>
                  <th className="num">Net (h)</th>
                  <th className="num">Mileage</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => {
                  const { total, brk, net, open } = entryHours(entry);
                  const offset = dayOffset(entry.clock_in, entry.clock_out);

                  return (
                    <tr key={entry.id}>
                      <td className="cell-title cell-strong">{entry.projects?.name}</td>
                      <td className="nowrap" data-label="Date">{formatDate(entry.clock_in)}</td>
                      <td className="nowrap" data-label="Time">
                        {formatTime(entry.clock_in)} → {open ? 'Ongoing' : formatTime(entry.clock_out)}
                        {offset > 0 && <span className="day-offset">+{offset} day{offset > 1 ? 's' : ''}</span>}
                      </td>
                      <td className="num hide-mobile" data-label="Total (h)">{open ? '–' : hours(total)}</td>
                      <td className="num hide-mobile" data-label="Break (h)">{open ? '–' : hours(brk)}</td>
                      <td className="num cell-strong" data-label="Net (h)">{open ? '–' : hours(net)}</td>
                      <td className="num" data-label="Mileage">{entry.mileage ? `${entry.mileage} km` : '–'}</td>
                      <td className="cell-notes" data-label="Notes">{entry.notes || '–'}</td>
                      <td data-label="Status"><EntryStatusBadge entry={entry} /></td>
                      <td className="cell-actions" data-label="">
                        {!entry.approved && (
                          <RowMenu
                            label={`Actions for ${entry.projects?.name || 'entry'}`}
                            items={[
                              { label: 'Edit', onClick: () => setEditingEntry(entry) },
                              { label: 'Delete', danger: true, onClick: () => setDeletingEntry(entry) },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(showAddForm || editingEntry) && (
        <TimeEntryForm
          profile={profile}
          projects={projectOptions}
          editingEntry={editingEntry}
          onClose={closeForm}
          onSave={() => {
            closeForm();
            loadTimeEntries();
          }}
        />
      )}

      {deletingEntry && (
        <ConfirmDialog
          title="Delete this time entry?"
          tone="danger"
          confirmLabel="Delete entry"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingEntry(null)}
        >
          <p>
            {deletingEntry.projects?.name} · {formatDate(deletingEntry.clock_in)}. This can&apos;t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default EmployeeDashboard;
