import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import ProjectForm from './ProjectForm';
import ProjectView from './ProjectView';

const ProjectsTab = ({ projects, onRefresh, employees }) => {
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get next serial number
  const getNextSerialNumber = () => {
    if (projects.length === 0) return 1288;
    const maxSerial = Math.max(...projects.map(p => parseInt(p.serial_number) || 0));
    return maxSerial + 1;
  };

  const nextSerial = getNextSerialNumber();

  const handleDeleteProject = async (id) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await supabase.from('projects').delete().eq('id', id);
      onRefresh();
    }
  };

  const handleIncrementInvoice = async (project) => {
    const { error } = await supabase
      .from('projects')
      .update({ invoice_count: project.invoice_count + 1 })
      .eq('id', project.id);
    
    if (!error) {
      onRefresh();
    }
  };

  const handleDecrementInvoice = async (project) => {
    if (project.invoice_count > 0) {
      const { error } = await supabase
        .from('projects')
        .update({ invoice_count: project.invoice_count - 1 })
        .eq('id', project.id);
      
      if (!error) {
        onRefresh();
      }
    }
  };

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    
    const matchesSearch = searchQuery === '' || 
      project.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.phone?.includes(searchQuery) ||
      project.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.serial_number?.toString().includes(searchQuery);
    
    return matchesStatus && matchesSearch;
  });

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
      {viewingProject ? (
        <ProjectView 
          project={viewingProject} 
          employees={employees}
          onClose={() => setViewingProject(null)}
          onEdit={() => {
            setEditingProject(viewingProject);
            setViewingProject(null);
          }}
        />
      ) : (
        <>
          <div className="row mb-3">
            <div className="col-md-4">
              <h4>Projects</h4>
            </div>
            <div className="col-md-8 text-end">
              <div className="d-inline-flex align-items-center gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '250px' }}
                />
                <select
                  className="form-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ width: '200px' }}
                >
                  <option value="all">All Status</option>
                  <option value="in progress">In Progress</option>
                  <option value="quote sent">Quote Sent</option>
                  <option value="40%">40%</option>
                  <option value="50% completed">50% Completed</option>
                  <option value="60%">60%</option>
                  <option value="invoiced">Invoiced</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Button 
                  onClick={() => {
                    setShowAddProject(true);
                    setEditingProject(null);
                  }} 
                  variant="primary"
                  disabled={editingProject !== null}
                >
                  Add Project
                </Button>
              </div>
            </div>
          </div>

          {(showAddProject || editingProject) && (
            <div className="row mb-3">
              <div className="col">
                <ProjectForm
                  project={editingProject}
                  employees={employees}
                  nextSerialNumber={showAddProject ? nextSerial : null}
                  onClose={() => {
                    setShowAddProject(false);
                    setEditingProject(null);
                  }}
                  onSave={() => {
                    setShowAddProject(false);
                    setEditingProject(null);
                    onRefresh();
                  }}
                />
              </div>
            </div>
          )}

          <Card>
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Address (Project)</th>
                    <th>Type</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Invoice #</th>
                    <th>Project Lead</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const projectLead = employees.find(e => e.id === project.project_lead_id);
                    
                    return (
                      <tr key={project.id}>
                        <td className="fw-bold">{project.serial_number}</td>
                        <td>{project.address}</td>
                        <td>
                          <span className="badge bg-secondary">{project.type}</span>
                        </td>
                        <td>{project.company_name || '-'}</td>
                        <td>
                          {project.contact_person}<br />
                          <small className="text-muted">{project.email}</small>
                        </td>
                        <td>
                          <span className={`badge bg-${statusColors[project.status] || 'secondary'}`}>
                            {project.status}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group" role="group">
                            <button
                              onClick={() => handleDecrementInvoice(project)}
                              className="btn btn-sm btn-outline-secondary"
                              title="Decrease invoice count"
                              disabled={project.invoice_count <= 0}
                            >
                              −
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              disabled
                              style={{ minWidth: '40px' }}
                            >
                              {project.invoice_count}
                            </button>
                            <button
                              onClick={() => handleIncrementInvoice(project)}
                              className="btn btn-sm btn-outline-secondary"
                              title="Increase invoice count"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>{projectLead?.full_name || '-'}</td>
                        <td>
                          <button
                            onClick={() => setViewingProject(project)}
                            className="btn btn-sm btn-outline-info me-2"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setEditingProject(project)}
                            className="btn btn-sm btn-outline-primary me-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className="btn btn-sm btn-outline-danger"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan="9" className="text-center text-muted py-4">
                        No projects found. {searchQuery || filterStatus !== 'all' ? 'Try adjusting your filters.' : 'Click "Add Project" to create one.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {filteredProjects.length > 0 && (
            <div className="mt-3 text-muted">
              Showing {filteredProjects.length} of {projects.length} projects
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectsTab;