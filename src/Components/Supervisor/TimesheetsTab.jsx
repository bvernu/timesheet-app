import { useState, useEffect } from 'react';
import Card from '../Common/Card';

const TimesheetsTab = ({ timeEntries, employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set default date range to last 7 days
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

  // Calculate total net hours
  const totalNetHours = filteredEntries.reduce((sum, entry) => {
    if (entry.clock_out) {
      const totalHours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
      const breakHours = calculateBreak(totalHours);
      const netHours = totalHours - breakHours;
      return sum + netHours;
    }
    return sum;
  }, 0);

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
          <table className="table table-hover table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Project</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Total Time</th>
                <th>Break</th>
                <th>Net Time</th>
                <th>Mileage</th>
                <th className="notes-col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const clockInDate = new Date(entry.clock_in);
                const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
                const totalHours = clockOutDate 
                  ? (clockOutDate - clockInDate) / (1000 * 60 * 60)
                  : 0;
                const breakHours = clockOutDate ? calculateBreak(totalHours) : 0;
                const netHours = clockOutDate ? totalHours - breakHours : 0;
                
                return (
                  <tr key={entry.id}>
                    <td className="fw-medium">{entry.profiles?.full_name || 'Unknown'}</td>
                    <td>{clockInDate.toLocaleDateString()}</td>
                    <td>{entry.projects?.name || 'Unknown'}</td>
                    <td>{clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{clockOutDate ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>{clockOutDate ? totalHours.toFixed(2) : 'Ongoing'}</td>
                    <td>{clockOutDate ? breakHours.toFixed(2) : '-'}</td>
                    <td className="fw-bold">{clockOutDate ? netHours.toFixed(2) : '-'}</td>
                    <td>{entry.mileage ? `${entry.mileage} km` : '-'}</td>
                    <td className="notes-col">{entry.notes || '-'}</td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center text-muted py-4">
                    No time entries found for this employee.
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
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default TimesheetsTab;