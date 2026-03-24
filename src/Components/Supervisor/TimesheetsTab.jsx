import { useState, useEffect } from 'react';
import Card from '../Common/Card';
import { supabase } from '../../supabaseClient';

const TimesheetsTab = ({ timeEntries, employees }) => {
  const [entries, setEntries] = useState(timeEntries);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [approving, setApproving] = useState(false);

  // Keep local state in sync if parent re-passes a new timeEntries array
  useEffect(() => {
    setEntries(timeEntries);
  }, [timeEntries]);

  // Default date range: last 7 days
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
  }, []);

  const calculateBreak = (hours) => {
    if (hours > 10) return 1.0;
    if (hours > 5) return 0.5;
    return 0;
  };

  const toggleNotes = (entryId) => {
    setExpandedNotes(prev => ({ ...prev, [entryId]: !prev[entryId] }));
  };

  const filteredEntries = entries.filter(entry => {
    const matchesEmployee = selectedEmployee === 'all' || entry.employee_id === selectedEmployee;
    let matchesDate = true;
    if (startDate || endDate) {
      const entryDate = new Date(entry.clock_in);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && entryDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && entryDate <= end;
      }
    }
    return matchesEmployee && matchesDate;
  });

  const approvableEntries = filteredEntries.filter(e => !e.approved && e.clock_out);
  const someSelected = selectedIds.size > 0;
  const allSelected = approvableEntries.length > 0 && approvableEntries.every(e => selectedIds.has(e.id));
  const indeterminate = someSelected && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvableEntries.map(e => e.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const patchApproved = (ids, approvedAt, approvedBy) => {
    setEntries(prev =>
      prev.map(e =>
        ids.includes(e.id)
          ? { ...e, approved: true, approved_at: approvedAt, approved_by: approvedBy }
          : e
      )
    );
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  };

  const handleBulkApprove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} timesheet entr${ids.length === 1 ? 'y' : 'ies'}? This action cannot be undone.`)) return;

    setApproving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('time_entries')
      .update({ approved: true, approved_by: user.id, approved_at: now })
      .in('id', ids);

    setApproving(false);

    if (error) {
      alert('Error approving entries: ' + error.message);
    } else {
      patchApproved(ids, now, user.id);
    }
  };

  const totalNetHours = filteredEntries.reduce((sum, entry) => {
    if (entry.clock_out) {
      const totalHours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
      return sum + (totalHours - calculateBreak(totalHours));
    }
    return sum;
  }, 0);

  return (
    <div className="pb-5">
      <div className="row mb-3">
        <div className="col-12">
          <h4 className="mb-3">Employee Timesheets</h4>
        </div>
        <div className="col-12">
          <div className="filter-section">
            <div className="row g-2 align-items-end">
              <div className="col-md-3 col-6">
                <label className="small fw-bold">From:</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-6">
                <label className="small fw-bold">To:</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="col-md-4 col-8">
                <label className="small fw-bold">Employee:</label>
                <select
                  className="form-select"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="all">All Employees</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 col-4 d-flex gap-2">
                {(startDate || endDate) && (
                  <button
                    className="btn btn-outline-secondary w-100"
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Project</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Total</th>
                <th>Break</th>
                <th>Net</th>
                <th>Mileage</th>
                <th>Notes</th>
                <th style={{ minWidth: '140px' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span>Actions</span>
                    {approvableEntries.length > 0 && (
                      <span
                        className="d-flex align-items-center gap-1"
                        title={`Select all pending entries. ${selectedIds.size} of ${approvableEntries.length} selected.`}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          style={{ cursor: 'pointer' }}
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = indeterminate; }}
                          onChange={toggleSelectAll}
                        />
                        <span className="small text-muted fw-normal">
                          {someSelected ? `${selectedIds.size}/${approvableEntries.length}` : 'All'}
                        </span>
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const clockInDate = new Date(entry.clock_in);
                const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
                const totalHours = clockOutDate ? (clockOutDate - clockInDate) / (1000 * 60 * 60) : 0;
                const breakHours = clockOutDate ? calculateBreak(totalHours) : 0;
                const netHours = clockOutDate ? totalHours - breakHours : 0;
                const hasNotes = entry.notes && entry.notes.trim() !== '';
                const isApprovable = !entry.approved && clockOutDate;
                const isSelected = selectedIds.has(entry.id);

                let rowClass = '';
                if (entry.approved) rowClass = 'table-success';
                else if (isSelected) rowClass = 'table-warning';

                return (
                  <tr
                    key={entry.id}
                    className={rowClass}
                    style={isSelected ? { outline: '2px solid #ffc107', outlineOffset: '-2px' } : {}}
                  >
                    <td className="fw-medium" style={{ minWidth: '120px' }}>
                      {entry.profiles?.full_name || 'Unknown'}
                      {entry.approved && <span className="badge bg-success ms-2">Approved</span>}
                    </td>
                    <td style={{ minWidth: '100px' }}>
                      {clockInDate.toLocaleDateString()}
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      {entry.projects?.name || 'Unknown'}
                    </td>
                    <td style={{ minWidth: '80px' }}>
                      {clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ minWidth: '80px' }}>
                      {clockOutDate
                        ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                    <td style={{ minWidth: '70px' }}>
                      {clockOutDate ? totalHours.toFixed(2) : 'Ongoing'}
                    </td>
                    <td style={{ minWidth: '60px' }}>
                      {clockOutDate ? breakHours.toFixed(2) : '-'}
                    </td>
                    <td className="fw-bold" style={{ minWidth: '70px' }}>
                      {clockOutDate ? netHours.toFixed(2) : '-'}
                    </td>
                    <td style={{ minWidth: '80px' }}>
                      {entry.mileage ? `${entry.mileage} km` : '-'}
                    </td>
                    <td style={{ minWidth: '100px', maxWidth: '200px' }}>
                      {hasNotes ? (
                        <div>
                          <button
                            className="btn btn-sm btn-link p-0 text-decoration-none"
                            onClick={() => toggleNotes(entry.id)}
                          >
                            {expandedNotes[entry.id] ? 'Hide' : 'View'}
                          </button>
                          {expandedNotes[entry.id] && (
                            <div className="small mt-1 text-muted">{entry.notes}</div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ minWidth: '140px' }}>
                      {isApprovable ? (
                        <button
                          className={`btn btn-sm ${isSelected ? 'btn-warning' : 'btn-outline-success'}`}
                          onClick={() => toggleSelectOne(entry.id)}
                          disabled={approving}
                          title={isSelected ? 'Click to deselect' : 'Click to queue for approval'}
                        >
                          {isSelected ? '✓ Selected' : 'Approve'}
                        </button>
                      ) : entry.approved ? (
                        <small className="text-muted">
                          Locked
                          {entry.approved_at && (
                            <div>{new Date(entry.approved_at).toLocaleDateString()}</div>
                          )}
                        </small>
                      ) : (
                        <small className="text-muted">Incomplete</small>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan="11" className="text-center text-muted py-4">
                    No time entries found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="table-active">
                <td colSpan="7" className="text-end fw-bold">Total Net Hours:</td>
                <td className="fw-bold" style={{ fontSize: '1.1rem' }}>
                  {totalNetHours.toFixed(2)}
                </td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Sticky bulk-approve bar — appears when any rows are queued */}
      {someSelected && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1050,
            background: '#212529',
            color: '#fff',
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minWidth: '320px',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="fw-medium">
            {selectedIds.size} entr{selectedIds.size === 1 ? 'y' : 'ies'} queued
          </span>
          <button
            className="btn btn-success btn-sm px-3"
            onClick={handleBulkApprove}
            disabled={approving}
          >
            {approving ? 'Approving…' : `Confirm Approval (${selectedIds.size})`}
          </button>
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={approving}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default TimesheetsTab;