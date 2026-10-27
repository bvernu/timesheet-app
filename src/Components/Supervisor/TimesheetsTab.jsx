import { useState, useEffect, useMemo } from 'react';
import Card from '../Common/Card';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import EmptyState from '../Common/EmptyState';
import Skeleton from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import { EntryStatusBadge } from '../Common/StatusBadge';
import { useToast } from '../Common/Toast';
import { supabase } from '../../supabaseClient';
import { downloadCsv } from '../../utils/csv';
import { dayOffset, entryHours, formatDate, formatTime, hours, isoDate } from '../../utils/format';

const defaultRange = () => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  return { start: isoDate(weekAgo), end: isoDate(today) };
};

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'all', label: 'All' },
];

const TimesheetsTab = ({ timeEntries, employees, loading = false }) => {
  const toast = useToast();
  const [entries, setEntries] = useState(timeEntries);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [startDate, setStartDate] = useState(() => defaultRange().start);
  const [endDate, setEndDate] = useState(() => defaultRange().end);
  const [status, setStatus] = useState('pending');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);

  // Keep local state in sync if parent re-passes a new timeEntries array
  useEffect(() => {
    setEntries(timeEntries);
  }, [timeEntries]);

  const isDefaultFilter = (() => {
    const d = defaultRange();
    return selectedEmployee === 'all' && status === 'pending' && startDate === d.start && endDate === d.end;
  })();

  const resetFilters = () => {
    const d = defaultRange();
    setSelectedEmployee('all');
    setStatus('pending');
    setStartDate(d.start);
    setEndDate(d.end);
  };

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (selectedEmployee !== 'all' && entry.employee_id !== selectedEmployee) return false;
    if (status === 'pending' && entry.approved) return false;
    if (status === 'approved' && !entry.approved) return false;
    const entryDate = new Date(entry.clock_in);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (entryDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (entryDate > end) return false;
    }
    return true;
  }), [entries, selectedEmployee, status, startDate, endDate]);

  const approvableEntries = filteredEntries.filter((e) => !e.approved && e.clock_out);
  const someSelected = selectedIds.size > 0;
  const allSelected = approvableEntries.length > 0 && approvableEntries.every((e) => selectedIds.has(e.id));
  const indeterminate = someSelected && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(approvableEntries.map((e) => e.id)));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const patchApproved = (ids, approvedAt, approvedBy) => {
    setEntries((prev) =>
      prev.map((e) => (ids.includes(e.id) ? { ...e, approved: true, approved_at: approvedAt, approved_by: approvedBy } : e))
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleBulkApprove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setApproving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('time_entries')
      .update({ approved: true, approved_by: user.id, approved_at: now })
      .in('id', ids);

    setApproving(false);
    setConfirming(false);

    if (error) {
      toast.error(`Couldn't approve the entries: ${error.message}`);
    } else {
      patchApproved(ids, now, user.id);
      toast.success(`${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} approved`);
    }
  };

  const totals = useMemo(() => {
    const byEmployee = new Map();
    let net = 0;
    filteredEntries.forEach((entry) => {
      const h = entryHours(entry).net;
      net += h;
      const key = entry.employee_id;
      const row = byEmployee.get(key) || { name: entry.profiles?.full_name || 'Unknown', net: 0 };
      row.net += h;
      byEmployee.set(key, row);
    });
    return { net, byEmployee: [...byEmployee.values()].sort((a, b) => b.net - a.net) };
  }, [filteredEntries]);

  const handleExport = () => {
    const rows = [[
      'Employee', 'Date', 'Project', 'Clock in', 'Clock out', 'Total hours', 'Break hours', 'Net hours', 'Mileage (km)', 'Notes', 'Status',
    ]];
    filteredEntries.forEach((entry) => {
      const { total, brk, net, open } = entryHours(entry);
      const clockIn = new Date(entry.clock_in);
      const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
      const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      rows.push([
        entry.profiles?.full_name || 'Unknown',
        isoDate(clockIn),
        entry.projects?.name || 'Unknown',
        hhmm(clockIn),
        clockOut ? `${isoDate(clockOut)} ${hhmm(clockOut)}` : '',
        open ? '' : hours(total),
        open ? '' : hours(brk),
        open ? '' : hours(net),
        entry.mileage ?? '',
        entry.notes || '',
        entry.approved ? 'Approved' : open ? 'In progress' : 'Pending',
      ]);
    });
    downloadCsv(`timesheets_${startDate || 'start'}_to_${endDate || 'today'}.csv`, rows);
  };

  const pendingInView = approvableEntries.length;

  return (
    <div>
      <PageHeader
        title="All timesheets"
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={filteredEntries.length === 0}>
            Export CSV
          </Button>
        }
      />

      <div className="toolbar">
        <div className="field toolbar-half">
          <label className="form-label" htmlFor="ts-from">From</label>
          <input id="ts-from" type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field toolbar-half">
          <label className="form-label" htmlFor="ts-to">To</label>
          <input id="ts-to" type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="ts-employee">Employee</label>
          <select id="ts-employee" className="form-select" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
            <option value="all">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.full_name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="form-label d-block" id="ts-status-label">Status</span>
          <div className="segmented" role="group" aria-labelledby="ts-status-label">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={status === opt.id ? 'active' : ''}
                aria-pressed={status === opt.id}
                onClick={() => setStatus(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!isDefaultFilter && (
          <div className="field toolbar-end">
            <Button variant="quiet" onClick={resetFilters}>Reset filters</Button>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">Net hours</div>
          <div className="stat-value">{hours(totals.net)}<span className="stat-unit">h</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Entries</div>
          <div className="stat-value">{filteredEntries.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Ready to approve</div>
          <div className="stat-value">{pendingInView}</div>
        </div>
      </div>

      {totals.byEmployee.length > 1 && (
        <div className="chip-row" aria-label="Net hours by employee">
          {totals.byEmployee.map((row) => (
            <span key={row.name} className="chip">{row.name} <strong>{hours(row.net)} h</strong></span>
          ))}
        </div>
      )}

      {approvableEntries.length > 0 && (
        <div className="mobile-only-block mb-2">
          <Button variant="secondary" size="sm" onClick={toggleSelectAll}>
            {allSelected ? 'Clear selection' : `Select all ${approvableEntries.length} pending`}
          </Button>
        </div>
      )}

      <Card flush>
        {loading ? (
          <Skeleton rows={5} />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            title={status === 'pending' ? 'Nothing waiting for approval' : 'No time entries found'}
            action={!isDefaultFilter || status !== 'all'
              ? <Button variant="secondary" onClick={() => { setStatus('all'); }}>Show all statuses</Button>
              : undefined}
          >
            {status === 'pending'
              ? 'There are no pending entries for these dates and employees.'
              : 'Try a different date range or employee.'}
          </EmptyState>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-stack">
              <thead>
                <tr>
                  <th className="check-cell">
                    {approvableEntries.length > 0 && (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label={`Select all ${approvableEntries.length} pending entries`}
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                        onChange={toggleSelectAll}
                      />
                    )}
                  </th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Time</th>
                  <th className="num hide-mobile">Total (h)</th>
                  <th className="num hide-mobile">Break (h)</th>
                  <th className="num">Net (h)</th>
                  <th className="num">Mileage</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const { total, brk, net, open } = entryHours(entry);
                  const offset = dayOffset(entry.clock_in, entry.clock_out);
                  const isApprovable = !entry.approved && !open;
                  const isSelected = selectedIds.has(entry.id);

                  return (
                    <tr key={entry.id} className={isSelected ? 'is-selected' : ''}>
                      <td className="check-cell" data-label="">
                        {isApprovable && (
                          <input
                            type="checkbox"
                            className="form-check-input"
                            aria-label={`Select entry by ${entry.profiles?.full_name || 'employee'} on ${formatDate(entry.clock_in)}`}
                            checked={isSelected}
                            disabled={approving}
                            onChange={() => toggleSelectOne(entry.id)}
                          />
                        )}
                      </td>
                      <td className="cell-title cell-strong nowrap">{entry.profiles?.full_name || 'Unknown'}</td>
                      <td className="nowrap" data-label="Date">{formatDate(entry.clock_in)}</td>
                      <td className="nowrap" data-label="Project">{entry.projects?.name || 'Unknown'}</td>
                      <td className="nowrap" data-label="Time">
                        {formatTime(entry.clock_in)} → {open ? 'Ongoing' : formatTime(entry.clock_out)}
                        {offset > 0 && <span className="day-offset">+{offset} day{offset > 1 ? 's' : ''}</span>}
                      </td>
                      <td className="num hide-mobile" data-label="Total (h)">{open ? '–' : hours(total)}</td>
                      <td className="num hide-mobile" data-label="Break (h)">{open ? '–' : hours(brk)}</td>
                      <td className="num cell-strong" data-label="Net (h)">{open ? '–' : hours(net)}</td>
                      <td className="num" data-label="Mileage">{entry.mileage ? `${entry.mileage} km` : '–'}</td>
                      <td className="cell-notes" data-label="Notes">{entry.notes?.trim() ? entry.notes : '–'}</td>
                      <td data-label="Status">
                        <div className="cell-stack">
                          <EntryStatusBadge entry={entry} />
                          {entry.approved && entry.approved_at && (
                            <span className="cell-sub">{formatDate(entry.approved_at)}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="hide-mobile">
                <tr>
                  <td colSpan={7} className="num">Total net hours</td>
                  <td className="num">{hours(totals.net)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Appears as soon as any rows are ticked */}
      {someSelected && (
        <div className="bulk-bar" role="region" aria-label="Approve selected entries">
          <span>{selectedIds.size} selected</span>
          <Button size="sm" onClick={() => setConfirming(true)} disabled={approving}>
            Approve selected
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())} disabled={approving}>
            Clear
          </Button>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={`Approve ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}?`}
          confirmLabel="Approve"
          busy={approving}
          onConfirm={handleBulkApprove}
          onCancel={() => setConfirming(false)}
        >
          <p>Approved entries are locked, and employees can no longer edit or delete them. This can&apos;t be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default TimesheetsTab;
