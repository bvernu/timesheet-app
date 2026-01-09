import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import TimeEntryForm from './TimeEntryForm';

const EmployeeDashboard = ({ profile }) => {
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    loadTimeEntries();
    loadProjects();
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
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('name');
    
    if (data) {
      setProjects(data);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      await supabase.from('time_entries').delete().eq('id', id);
      loadTimeEntries();
    }
  };

  const calculateBreak = (hours) => {
    if (hours > 10) return 1.0;
    if (hours > 5) return 0.5;
    return 0;
  };

  return (
    <div className="container">
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2>{profile.full_name}'s Timesheet</h2>
            <Button 
              onClick={() => {
                setShowAddForm(true);
                setEditingEntry(null);
              }}
              variant="primary"
              style={{ 
                backgroundColor: '#F18F20', 
                borderColor: '#F18F20',
                padding: '0.75rem 1.5rem',
                fontSize: '1.1rem'
              }}
            >
              Add Time Entry
            </Button>
          </div>
        </div>
      </div>

      {(showAddForm || editingEntry) && (
        <div className="row mb-4">
          <div className="col">
            <TimeEntryForm
              profile={profile}
              projects={projects}
              editingEntry={editingEntry}
              onClose={() => {
                setShowAddForm(false);
                setEditingEntry(null);
              }}
              onSave={() => {
                setShowAddForm(false);
                setEditingEntry(null);
                loadTimeEntries();
              }}
            />
          </div>
        </div>
      )}

      <div className="row">
        <div className="col">
          <Card>
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Total Time</th>
                    <th>Break</th>
                    <th>Net Time</th>
                    <th>Mileage</th>
                    <th className="hide-mobile">Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((entry) => {
                    const clockInDate = new Date(entry.clock_in);
                    const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
                    const totalHours = clockOutDate 
                      ? (clockOutDate - clockInDate) / (1000 * 60 * 60)
                      : 0;
                    const breakHours = clockOutDate ? calculateBreak(totalHours) : 0;
                    const netHours = clockOutDate ? totalHours - breakHours : 0;
                    
                    return (
                      <tr key={entry.id}>
                        <td>{entry.projects?.name}</td>
                        <td>{clockInDate.toLocaleDateString()}</td>
                        <td>{clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{clockOutDate ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td>{clockOutDate ? totalHours.toFixed(2) : 'Ongoing'}</td>
                        <td>{clockOutDate ? breakHours.toFixed(2) : '-'}</td>
                        <td className="fw-bold">{clockOutDate ? netHours.toFixed(2) : '-'}</td>
                        <td>{entry.mileage ? `${entry.mileage} km` : '-'}</td>
                        <td className="hide-mobile">{entry.notes || '-'}</td>
                        <td>
                          <button
                            onClick={() => setEditingEntry(entry)}
                            className="btn btn-sm btn-outline-primary me-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="btn btn-sm btn-outline-danger"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {timeEntries.length === 0 && (
                    <tr>
                      <td colSpan="10" className="text-center text-muted py-4">
                        No time entries yet. Click "Add Time Entry" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;