import { useState } from 'react';
import Card from '../Common/Card';

const TimesheetsTab = ({ timeEntries, employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const filteredEntries = timeEntries.filter(entry => {
    const matchesEmployee = selectedEmployee === 'all' || entry.employee_id === selectedEmployee;
    
    // Date filtering
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

  return (
    <div>
      <div className="row mb-3">
        <div className="col-md-3">
          <h4>Employee Timesheets</h4>
        </div>
        <div className="col-md-9 text-end">
          <div className="d-inline-flex align-items-center gap-2">
            <label className="me-1 small">From:</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '150px' }}
            />
            <label className="me-1 small">To:</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '150px' }}
            />
            {(startDate || endDate) && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear
              </button>
            )}
            <label className="me-2">Employee:</label>
            <select
              className="form-select form-select-sm"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="all">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Hours</th>
                <th>Project</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const clockInDate = new Date(entry.clock_in);
                const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
                const hours = clockOutDate 
                  ? ((clockOutDate - clockInDate) / (1000 * 60 * 60)).toFixed(2)
                  : 'Ongoing';
                
                return (
                  <tr key={entry.id}>
                    <td className="fw-bold">{entry.profiles?.full_name || 'Unknown'}</td>
                    <td>{clockInDate.toLocaleDateString()}</td>
                    <td>{clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{clockOutDate ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>{hours}</td>
                    <td>{entry.projects?.name || 'Unknown'}</td>
                    <td>{entry.notes || '-'}</td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    No time entries found for this employee.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default TimesheetsTab;