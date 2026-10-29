import { Fragment, useState, useEffect, useMemo } from 'react';
import Card from '../Common/Card';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import EmptyState from '../Common/EmptyState';
import Skeleton from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import { EntryStatusBadge } from '../Common/StatusBadge';
import { useToast } from '../Common/Toast';
import { supabase } from '../../supabaseClient';
import ExpandableText from '../Common/ExpandableText';
import { downloadXlsx } from '../../utils/xlsx';
import { useMediaQuery } from '../../utils/useMediaQuery';
import { dayOffset, entryHours, formatDate, formatTime, hours, isoDate, parseLocalDate } from '../../utils/format';

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
  const isPhone = useMediaQuery('(max-width: 767.98px)');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

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
      const start = parseLocalDate(startDate); // local midnight at the start of that day
      if (entryDate < start) return false;
    }
    if (endDate) {
      const end = parseLocalDate(endDate);
      end.setHours(23, 59, 59, 999); // ...and the very end of that same local day
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

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Tapping anywhere on a row selects it for approval. Buttons, links, the checkbox itself, and
  // highlighting text (to copy it) are left alone.
  const handleRowClick = (e, entry) => {
    if (approving || entry.approved || !entry.clock_out) return;
    if (e.target.closest('button, a, input, label, select, textarea')) return;
    if (window.getSelection && String(window.getSelection()).length > 0) return;
    toggleSelectOne(entry.id);
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
      const row = byEmployee.get(key) || { name: entry.profiles?.full_name || 'Unknown', net: 0, entries: 0 };
      row.net += h;
      row.entries += 1;
      byEmployee.set(key, row);
    });
    return { net, byEmployee: [...byEmployee.values()].sort((a, b) => b.net - a.net) };
  }, [filteredEntries]);

  // Real Excel file: dates and times are true date/time cells and the hours are numbers,
  // so they display correctly straight away and can be sorted, filtered and summed.
  const handleExport = () => {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const rows = filteredEntries.map((entry) => {
      const { total, brk, net, open } = entryHours(entry);
      const clockIn = new Date(entry.clock_in);
      return [
        entry.profiles?.full_name || 'Unknown',
        startOfDay(clockIn),
        entry.projects?.name || 'Unknown',
        clockIn,
        entry.clock_out ? new Date(entry.clock_out) : null,
        open ? null : total,
        open ? null : brk,
        open ? null : net,
        entry.mileage === null || entry.mileage === undefined || entry.mileage === '' ? null : Number(entry.mileage),
        entry.notes || null,
        entry.approved ? 'Approved' : open ? 'In progress' : 'Pending',
        entry.approved_at ? startOfDay(new Date(entry.approved_at)) : null,
      ];
    });

    downloadXlsx(`timesheets_${startDate || 'start'}_to_${endDate || 'today'}.xlsx`, [
      {
        name: 'Timesheets',
        columns: [
          { header: 'Employee', width: 22 },
          { header: 'Date', width: 13, style: 'date' },
          { header: 'Project', width: 28 },
          { header: 'Clock in', width: 21, style: 'datetime' },
          { header: 'Clock out', width: 21, style: 'datetime' },
          { header: 'Total hours', width: 12, style: 'hours' },
          { header: 'Break hours', width: 12, style: 'hours' },
          { header: 'Net hours', width: 12, style: 'hours' },
          { header: 'Mileage (km)', width: 13, style: 'distance' },
          { header: 'Notes', width: 42, style: 'wrap' },
          { header: 'Status', width: 13 },
          { header: 'Approved on', width: 13, style: 'date' },
        ],
        rows,
        totals: { label: 'Total', sum: [5, 6, 7, 8] },
      },
      {
        name: 'By employee',
        columns: [
          { header: 'Employee', width: 26 },
          { header: 'Entries', width: 10, style: 'count' },
          { header: 'Net hours', width: 12, style: 'hours' },
        ],
        rows: totals.byEmployee.map((r) => [r.name, r.entries, r.net]),
        totals: { label: 'Total', sum: [1, 2] },
      },
    ]);
  };

  const isApprovable = (entry) => !entry.approved && !!entry.clock_out;

  const entryDetails = (entry) => {
    const { total, brk, open } = entryHours(entry);
    const offset = dayOffset(entry.clock_in, entry.clock_out);
    return (
      <dl className="detail-list detail-list-compact">
        <dt>Project</dt>
        <dd>{entry.projects?.name || 'Unknown'}</dd>
        <dt>Time</dt>
        <dd>
          {formatTime(entry.clock_in)} → {open ? 'Ongoing' : formatTime(entry.clock_out)}
          {offset > 0 && <span className="day-offset">+{offset} day{offset > 1 ? 's' : ''}</span>}
        </dd>
        <dt>Total</dt>
        <dd>{open ? '–' : `${hours(total)} h`}</dd>
        <dt>Break</dt>
        <dd>{open ? '–' : `${hours(brk)} h`}</dd>
        <dt>Mileage</dt>
        <dd>{entry.mileage ? `${entry.mileage} km` : '–'}</dd>
        <dt>Status</dt>
        <dd>
          <EntryStatusBadge entry={entry} />
          {entry.approved && entry.approved_at && <span className="text-muted"> · {formatDate(entry.approved_at)}</span>}
        </dd>
        {entry.notes?.trim() && (
          <>
            <dt>Notes</dt>
            <dd><ExpandableText text={entry.notes} /></dd>
          </>
        )}
      </dl>
    );
  };

  // Phones: a compact table (select box, who/when, net hours, expand) instead of a very wide one.
  // Tap a row to select it; tap the arrow to see the rest of that entry.
  const renderPhoneTable = () => (
    <div className="table-responsive">
      <table className="table m-table">
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
            <th>Entry</th>
            <th className="num">Net (h)</th>
            <th aria-label="Details"></th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.map((entry) => {
            const { net, open } = entryHours(entry);
            const approvable = isApprovable(entry);
            const isSelected = selectedIds.has(entry.id);
            const isExpanded = expandedIds.has(entry.id);
            const name = entry.profiles?.full_name || 'Unknown';

            return (
              <Fragment key={entry.id}>
                <tr
                  className={`${isSelected ? 'is-selected' : ''}${approvable ? ' is-clickable' : ''}`}
                  onClick={(e) => handleRowClick(e, entry)}
                >
                  <td className="check-cell">
                    {approvable && (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label={`Select entry by ${name} on ${formatDate(entry.clock_in)}`}
                        checked={isSelected}
                        disabled={approving}
                        onChange={() => toggleSelectOne(entry.id)}
                      />
                    )}
                  </td>
                  <td>
                    <div className="cell-strong">{name}</div>
                    <div className="cell-sub">
                      {formatDate(entry.clock_in)}
                      {(entry.approved || open) && <span className="m-status"><EntryStatusBadge entry={entry} /></span>}
                    </div>
                  </td>
                  <td className="num cell-strong">{open ? '–' : hours(net)}</td>
                  <td className="expand-cell">
                    <button
                      type="button"
                      className="chevron-button"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${name} on ${formatDate(entry.clock_in)}`}
                      onClick={() => toggleExpanded(entry.id)}
                    >
                      <span aria-hidden="true">▾</span>
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="detail-row">
                    <td colSpan={4}>{entryDetails(entry)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total net hours</td>
            <td className="num">{hours(totals.net)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const renderDesktopTable = () => (
    <div className="table-responsive">
      <table className="table table-hover">
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
            <th className="num">Total (h)</th>
            <th className="num">Break (h)</th>
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
            const approvable = isApprovable(entry);
            const isSelected = selectedIds.has(entry.id);

            return (
              <tr
                key={entry.id}
                className={`${isSelected ? 'is-selected' : ''}${approvable ? ' is-clickable' : ''}`}
                onClick={(e) => handleRowClick(e, entry)}
              >
                <td className="check-cell">
                  {approvable && (
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
                <td className="cell-strong nowrap">{entry.profiles?.full_name || 'Unknown'}</td>
                <td className="nowrap">{formatDate(entry.clock_in)}</td>
                <td className="nowrap">{entry.projects?.name || 'Unknown'}</td>
                <td className="nowrap">
                  {formatTime(entry.clock_in)} → {open ? 'Ongoing' : formatTime(entry.clock_out)}
                  {offset > 0 && <span className="day-offset">+{offset} day{offset > 1 ? 's' : ''}</span>}
                </td>
                <td className="num">{open ? '–' : hours(total)}</td>
                <td className="num">{open ? '–' : hours(brk)}</td>
                <td className="num cell-strong">{open ? '–' : hours(net)}</td>
                <td className="num">{entry.mileage ? `${entry.mileage} km` : '–'}</td>
                <td className="cell-notes">
                  {entry.notes?.trim() ? <ExpandableText text={entry.notes} /> : '–'}
                </td>
                <td>
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
        <tfoot>
          <tr>
            <td colSpan={7} className="num">Total net hours</td>
            <td className="num">{hours(totals.net)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const pendingInView = approvableEntries.length;

  const dateFields = (
    <>
      <div className="field toolbar-half">
        <label className="form-label" htmlFor="ts-from">From</label>
        <input id="ts-from" type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="field toolbar-half">
        <label className="form-label" htmlFor="ts-to">To</label>
        <input id="ts-to" type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
    </>
  );

  const employeeField = (
    <div className="field">
      <label className="form-label" htmlFor="ts-employee">Employee</label>
      <select id="ts-employee" className="form-select" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
        <option value="all">All employees</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>{employee.full_name}</option>
        ))}
      </select>
    </div>
  );

  const statusSwitch = (
    <div className="segmented" role="group" aria-label="Status">
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
  );

  const employeeName = selectedEmployee === 'all' ? 'All employees' : employees.find((e) => e.id === selectedEmployee)?.full_name || 'Employee';
  const filterSummary = `${startDate ? formatDate(startDate) : 'Start'} – ${endDate ? formatDate(endDate) : 'Today'} · ${employeeName}`;

  return (
    <div>
      <PageHeader
        title="All timesheets"
        hideTitleOnPhone
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={filteredEntries.length === 0}>
            Export to Excel
          </Button>
        }
      />

      {isPhone ? (
        <div className="phone-filters">
          {statusSwitch}
          <button
            type="button"
            className="filter-summary"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="filter-summary-label">Filters</span>
            <span className="filter-summary-text">{filterSummary}</span>
            <span className="filter-summary-caret" aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
          </button>
          {filtersOpen && (
            <div className="toolbar filter-panel">
              {dateFields}
              {employeeField}
              {!isDefaultFilter && <Button variant="quiet" onClick={resetFilters}>Reset filters</Button>}
            </div>
          )}
        </div>
      ) : (
        <div className="toolbar">
          {dateFields}
          {employeeField}
          <div className="field">
            <span className="form-label d-block" id="ts-status-label">Status</span>
            {statusSwitch}
          </div>
          {!isDefaultFilter && (
            <div className="field toolbar-end">
              <Button variant="quiet" onClick={resetFilters}>Reset filters</Button>
            </div>
          )}
        </div>
      )}

      {isPhone ? (
        <div className="stat-strip" aria-label="Summary">
          <div><strong>{hours(totals.net)}</strong><span>net hours</span></div>
          <div><strong>{filteredEntries.length}</strong><span>entries</span></div>
          <div><strong>{pendingInView}</strong><span>to approve</span></div>
        </div>
      ) : (
        <>
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
        </>
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
          isPhone ? renderPhoneTable() : renderDesktopTable()
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
