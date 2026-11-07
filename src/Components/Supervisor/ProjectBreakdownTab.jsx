import { useState } from 'react';
import Card from '../Common/Card';

const ProjectBreakdownTab = ({ timeEntries, projects, employees }) => {
  const [selectedProject, setSelectedProject] = useState('all');
  
  // Filter entries by selected project
  const filteredEntries = selectedProject === 'all' 
    ? timeEntries 
    : timeEntries.filter(entry => entry.project_id === selectedProject);

  // Calculate hours by employee for the selected project
  const employeeHoursBreakdown = {};
  
  filteredEntries.forEach((entry) => {
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

  const selectedProjectName = selectedProject === 'all' 
    ? 'All Projects' 
    : projects.find(p => p.id === selectedProject)?.name || 'Unknown';

  return (
    <div>
      <div className="row mb-3">
        <div className="col-md-6">
          <h4>Project Hours Breakdown</h4>
        </div>
        <div className="col-md-6 text-end">
          <div className="d-inline-flex align-items-center">
            <label className="me-2">Select Project:</label>
            <select
              className="form-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6">
          <Card>
            <h5 className="mb-3">{selectedProjectName}</h5>
            <h2 className="mb-0">{totalProjectHours.toFixed(2)} hours</h2>
            <p className="text-muted mb-0">Total hours logged</p>
          </Card>
        </div>
        <div className="col-md-6">
          <Card>
            <h5 className="mb-3">Contributors</h5>
            <h2 className="mb-0">{Object.keys(employeeHoursBreakdown).length}</h2>
            <p className="text-muted mb-0">Employees worked on this project</p>
          </Card>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <Card title="Hours by Employee">
            <div className="mt-3">
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
                          backgroundColor: 'var(--brand-primary)'
                        }}
                        aria-valuenow={(data.hours / totalProjectHours) * 100}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                    <small className="text-muted">{data.entries.length} time entries</small>
                  </div>
                ))}
              {Object.keys(employeeHoursBreakdown).length === 0 && (
                <p className="text-muted text-center py-4">No hours logged for this project yet</p>
              )}
            </div>
          </Card>
        </div>

        <div className="col-md-6">
          <Card title="Detailed Entries">
            <div className="mt-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Object.entries(employeeHoursBreakdown)
                .sort(([, a], [, b]) => b.hours - a.hours)
                .map(([employeeId, data]) => (
                  <div key={employeeId} className="mb-4">
                    <h6 className="fw-bold text-primary">{data.name}</h6>
                    <ul className="list-unstyled ms-3">
                      {data.entries.map((entry) => {
                        const clockInDate = new Date(entry.clock_in);
                        const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
                        const hours = clockOutDate 
                          ? ((clockOutDate - clockInDate) / (1000 * 60 * 60)).toFixed(2)
                          : 'Ongoing';
                        
                        return (
                          <li key={entry.id} className="mb-2 pb-2 border-bottom">
                            <div className="d-flex justify-content-between">
                              <small className="text-muted">
                                {clockInDate.toLocaleDateString()}
                              </small>
                              <small className="fw-bold">{hours} hrs</small>
                            </div>
                            <small className="text-muted">
                              {clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                              {clockOutDate ? ' ' + clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ' Ongoing'}
                            </small>
                            {entry.notes && (
                              <div>
                                <small className="text-muted fst-italic">{entry.notes}</small>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              {Object.keys(employeeHoursBreakdown).length === 0 && (
                <p className="text-muted text-center py-4">No entries to display</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProjectBreakdownTab;
