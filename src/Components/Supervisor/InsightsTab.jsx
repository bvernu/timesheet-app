import Card from '../Common/Card';

const InsightsTab = ({ timeEntries, employees, projects }) => {
  // Calculate total hours by project
  const projectHours = {};
  const employeeHours = {};

  timeEntries.forEach((entry) => {
    if (entry.clock_out) {
      const hours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
      
      const projectName = entry.projects?.name || 'Unknown';
      projectHours[projectName] = (projectHours[projectName] || 0) + hours;
      
      const employeeName = entry.profiles?.full_name || 'Unknown';
      employeeHours[employeeName] = (employeeHours[employeeName] || 0) + hours;
    }
  });

  const totalHours = Object.values(projectHours).reduce((sum, h) => sum + h, 0);

  return (
    <div>
      <h4 className="mb-4">Insights</h4>

      <div className="row mb-4">
        <div className="col-md-4">
          <Card>
            <h6 className="text-muted mb-2">Total Employees</h6>
            <h2 className="mb-0">{employees.length}</h2>
          </Card>
        </div>
        
        <div className="col-md-4">
          <Card>
            <h6 className="text-muted mb-2">Total Projects</h6>
            <h2 className="mb-0">{projects.length}</h2>
          </Card>
        </div>
        
        <div className="col-md-4">
          <Card>
            <h6 className="text-muted mb-2">Total Hours Logged</h6>
            <h2 className="mb-0">{totalHours.toFixed(2)}</h2>
          </Card>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-4">
          <Card title="Hours by Project">
            <div className="mt-3">
              {Object.entries(projectHours)
                .sort(([, a], [, b]) => b - a)
                .map(([project, hours]) => (
                  <div key={project} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>{project}</span>
                      <span className="fw-bold">{hours.toFixed(2)} hrs</span>
                    </div>
                    <div className="progress" style={{ height: '10px' }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${(hours / totalHours) * 100}%`, backgroundColor: 'var(--brand-primary)' }}
                        aria-valuenow={(hours / totalHours) * 100}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                  </div>
                ))}
              {Object.keys(projectHours).length === 0 && (
                <p className="text-muted text-center py-4">No data available yet</p>
              )}
            </div>
          </Card>
        </div>

        <div className="col-md-6 mb-4">
          <Card title="Hours by Employee">
            <div className="mt-3">
              {Object.entries(employeeHours)
                .sort(([, a], [, b]) => b - a)
                .map(([employee, hours]) => (
                  <div key={employee} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>{employee}</span>
                      <span className="fw-bold">{hours.toFixed(2)} hrs</span>
                    </div>
                    <div className="progress" style={{ height: '10px' }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${(hours / totalHours) * 100}%`, backgroundColor: 'var(--brand-primary)' }}
                        aria-valuenow={(hours / totalHours) * 100}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                  </div>
                ))}
              {Object.keys(employeeHours).length === 0 && (
                <p className="text-muted text-center py-4">No data available yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InsightsTab;
