import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';

const ProjectView = ({ project, onClose, onEdit, employees }) => {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectTimeEntries();
  }, [project.id]);

  const loadProjectTimeEntries = async () => {
    const { data } = await supabase
      .from('time_entries')
      .select(`
        *,
        profiles!time_entries_employee_id_fkey (full_name)
      `)
      .eq('project_id', project.id)
      .order('clock_in', { ascending: false });
    
    if (data) {
      setTimeEntries(data);
    }
    setLoading(false);
  };

  // Calculate hours by employee
  const employeeHoursBreakdown = {};
  
  timeEntries.forEach((entry) => {
    if (entry.clock_out) {
      const hours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
      const employeeName = entry.profiles?.full_name || 'Unknown';
      const employeeId = entry.employee_id;
      
      if (!employeeHoursBreakdown[employeeId]) {
        employeeHoursBreakdown[employeeId] = {
          name: employeeName,
          hours: 0,
          entries: []
        };
      }
      
      employeeHoursBreakdown[employeeId].hours += hours;
      employeeHoursBreakdown[employeeId].entries.push(entry);
    }
  });

  const totalProjectHours = Object.values(employeeHoursBreakdown)
    .reduce((sum, emp) => sum + emp.hours, 0);

  const projectLead = employees.find(e => e.id === project.project_lead_id);

  const statusColors = {
    'completed': 'success',
    'cancelled': 'danger',
    'in progress': 'primary',
    '50% completed': 'info',
    'quote sent': 'warning',
    '60%': 'info',
    '40%': 'info',
    'invoiced': 'success'
  };

  return (
    <div>
      <Card>
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h3 className="mb-2">Project #{project.serial_number}</h3>
            <h5 className="text-muted">{project.address}</h5>
          </div>
          <div>
            <Button onClick={onEdit} variant="primary" className="me-2">
              Edit Project
            </Button>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-md-6">
            <h6 className="fw-bold mb-3">Project Details</h6>
            <table className="table table-sm">
              <tbody>
                <tr>
                  <td className="fw-bold" style={{ width: '40%' }}>Type:</td>
                  <td><span className="badge bg-secondary">{project.type}</span></td>
                </tr>
                <tr>
                  <td className="fw-bold">Status:</td>
                  <td>
                    <span className={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                      {project.status}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="fw-bold">Invoice Count:</td>
                  <td>{project.invoice_count}</td>
                </tr>
                <tr>
                  <td className="fw-bold">Project Lead:</td>
                  <td>{projectLead?.full_name || '-'}</td>
                </tr>
                {project.job_description && (
                  <tr>
                    <td className="fw-bold">Description:</td>
                    <td>{project.job_description}</td>
                  </tr>
                )}
                {project.notes && (
                  <tr>
                    <td className="fw-bold">Notes:</td>
                    <td>{project.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="col-md-6">
            <h6 className="fw-bold mb-3">Contact Information</h6>
            <table className="table table-sm">
              <tbody>
                <tr>
                  <td className="fw-bold" style={{ width: '40%' }}>Contact Person:</td>
                  <td>{project.contact_person}</td>
                </tr>
                {project.company_name && (
                  <tr>
                    <td className="fw-bold">Company:</td>
                    <td>{project.company_name}</td>
                  </tr>
                )}
                {project.email && (
                  <tr>
                    <td className="fw-bold">Email:</td>
                    <td>{project.email}</td>
                  </tr>
                )}
                {project.phone && (
                  <tr>
                    <td className="fw-bold">Phone:</td>
                    <td>{project.phone}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <h6 className="fw-bold mb-3 mt-4">Financial Information</h6>
            <table className="table table-sm">
              <tbody>
                {project.quotation_amount && (
                  <tr>
                    <td className="fw-bold" style={{ width: '40%' }}>Quotation:</td>
                    <td>
                      ${project.quotation_amount}
                      {project.quotation_date && ` (${new Date(project.quotation_date).toLocaleDateString()})`}
                    </td>
                  </tr>
                )}
                {project.invoice_amount && (
                  <tr>
                    <td className="fw-bold">Invoice:</td>
                    <td>
                      ${project.invoice_amount}
                      {project.invoice_date && ` (${new Date(project.invoice_date).toLocaleDateString()})`}
                    </td>
                  </tr>
                )}
                {project.payment_amount && (
                  <tr>
                    <td className="fw-bold">Payment:</td>
                    <td>
                      ${project.payment_amount}
                      {project.payment_date && ` (${new Date(project.payment_date).toLocaleDateString()})`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="row mt-4">
        <div className="col-md-6">
          <Card title="Project Summary">
            <div className="row text-center">
              <div className="col-6 mb-3">
                <h2>{totalProjectHours.toFixed(2)}</h2>
                <p className="text-muted mb-0">Total Hours</p>
              </div>
              <div className="col-6 mb-3">
                <h2>{Object.keys(employeeHoursBreakdown).length}</h2>
                <p className="text-muted mb-0">Contributors</p>
              </div>
            </div>
          </Card>

          <Card title="Hours by Employee" className="mt-3">
            {Object.entries(employeeHoursBreakdown)
              .sort(([, a], [, b]) => b.hours - a.hours)
              .map(([employeeId, data]) => (
                <div key={employeeId} className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="fw-bold">{data.name}</span>
                    <span>{data.hours.toFixed(2)} hrs</span>
                  </div>
                  <div className="progress" style={{ height: '10px' }}>
                    <div
                      className="progress-bar"
                      role="progressbar"
                      style={{ 
                        width: `${(data.hours / totalProjectHours) * 100}%`,
                        backgroundColor: '#F18F20'
                      }}
                    />
                  </div>
                  <small className="text-muted">{data.entries.length} time entries</small>
                </div>
              ))}
            {Object.keys(employeeHoursBreakdown).length === 0 && (
              <p className="text-muted text-center py-4">No hours logged yet</p>
            )}
          </Card>
        </div>

        <div className="col-md-6">
          <Card title="Time Entries">
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loading ? (
                <p className="text-center py-4">Loading...</p>
              ) : timeEntries.length === 0 ? (
                <p className="text-muted text-center py-4">No time entries yet</p>
              ) : (
                <div className="list-group list-group-flush">
                  {timeEntries.map((entry) => {
                    const clockInDate = new Date(entry.clock_in);
                    const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
                    const hours = clockOutDate 
                      ? ((clockOutDate - clockInDate) / (1000 * 60 * 60)).toFixed(2)
                      : 'Ongoing';
                    
                    return (
                      <div key={entry.id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className="mb-1">{entry.profiles?.full_name || 'Unknown'}</h6>
                            <p className="mb-1 text-muted small">
                              {clockInDate.toLocaleDateString()} • 
                              {clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                              {clockOutDate ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ' Ongoing'}
                            </p>
                            {entry.notes && (
                              <p className="mb-0 small fst-italic">{entry.notes}</p>
                            )}
                          </div>
                          <span className="badge bg-primary">{hours} hrs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;