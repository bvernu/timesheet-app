import { useState, useEffect } from 'react';
import Card from '../Common/Card';

const TimesheetsTab = ({ timeEntries, employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});

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

  const toggleNotes = (entryId) => {
    setExpandedNotes(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
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
        <div className="col-12">
          <h4 className="mb-3">Employee Timesheets</h4>
        </div>
        <div className="col-12">
          <div className="filter-section">
            <div className="row g-2">
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
              <div className="col-md-2 col-4 d-flex align-items-end">
                {(startDate || endDate) && (
                  <button
                    className="btn btn-outline-secondary w-100"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
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
                const hasNotes = entry.notes && entry.notes.trim() !== '';
                
                return (
                  <tr key={entry.id}>
                    <td className="fw-medium" style={{ minWidth: '120px' }}>
                      {entry.profiles?.full_name || 'Unknown'}
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
                      {clockOutDate ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
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
                            <div className="small mt-1 text-muted">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center text-muted py-4">
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