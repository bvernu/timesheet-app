import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import RowMenu from '../Common/RowMenu';
import EmptyState from '../Common/EmptyState';
import Skeleton from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import { ProjectStatusBadge, TypeChip } from '../Common/StatusBadge';
import { useToast } from '../Common/Toast';
import ProjectForm from './ProjectForm';
import ProjectView from './ProjectView';
import { useTenant } from '../../tenant/TenantContext';

const STATUS_OPTIONS = [
  ['in progress', 'In progress'],
  ['quote sent', 'Quote sent'],
  ['40%', '40%'],
  ['50% completed', '50% completed'],
  ['60%', '60%'],
  ['invoiced', 'Invoiced'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const ProjectsTab = ({ projects, onRefresh, employees, loading = false, viewerRole = 'supervisor' }) => {
  const tenant = useTenant();
  const toast = useToast();
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [scope, setScope] = useState('active'); // active | archived
  const [confirm, setConfirm] = useState(null); // { kind: 'archive' | 'restore' | 'delete', project }
  const [busy, setBusy] = useState(false);

  // Serial numbers keep counting up across ALL projects (archived ones included) so a number is never reused
  const getNextSerialNumber = () => {
    if (projects.length === 0) return tenant.project_serial_start ?? 1;
    const maxSerial = Math.max(...projects.map((p) => parseInt(p.serial_number) || 0));
    return maxSerial + 1;
  };
  const nextSerial = getNextSerialNumber();

  const runConfirmed = async () => {
    const { kind, project } = confirm;
    setBusy(true);
    let error;
    if (kind === 'delete') {
      ({ error } = await supabase.from('projects').delete().eq('id', project.id));
    } else {
      ({ error } = await supabase
        .from('projects')
        .update({ archived_at: kind === 'archive' ? new Date().toISOString() : null })
        .eq('id', project.id));
    }
    setBusy(false);
    setConfirm(null);
    if (error) {
      toast.error(`Something went wrong: ${error.message}`);
      return;
    }
    toast.success(
      kind === 'archive' ? 'Project archived' : kind === 'restore' ? 'Project restored' : 'Project deleted'
    );
    onRefresh();
  };

  const q = searchQuery.trim().toLowerCase();
  const inScope = projects.filter((p) => (scope === 'archived' ? !!p.archived_at : !p.archived_at));
  const filteredProjects = inScope.filter((project) => {
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    const matchesSearch =
      q === '' ||
      project.address?.toLowerCase().includes(q) ||
      project.company_name?.toLowerCase().includes(q) ||
      project.contact_person?.toLowerCase().includes(q) ||
      project.email?.toLowerCase().includes(q) ||
      project.phone?.includes(searchQuery.trim()) ||
      project.type?.toLowerCase().includes(q) ||
      project.serial_number?.toString().includes(q);
    return matchesStatus && matchesSearch;
  });
  const archivedCount = projects.filter((p) => p.archived_at).length;
  const filtersActive = q !== '' || filterStatus !== 'all';

  const openAdd = () => {
    setEditingProject(null);
    setShowAddProject(true);
  };

  if (viewingProject) {
    return (
      <ProjectView
        project={viewingProject}
        employees={employees}
        viewerRole={viewerRole}
        onRefresh={onRefresh}
        onClose={() => setViewingProject(null)}
        onEdit={() => {
          setEditingProject(viewingProject);
          setViewingProject(null);
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Projects" hideTitleOnPhone actions={<Button onClick={openAdd}>Add project</Button>} />

      <div className="toolbar">
        <div className="field toolbar-grow">
          <label className="form-label" htmlFor="pj-search">Search</label>
          <input
            id="pj-search"
            type="search"
            className="form-control"
            placeholder="Address, company, contact, number…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="form-label" htmlFor="pj-status">Status</label>
          <select id="pj-status" className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="form-label d-block" id="pj-scope-label">Show</span>
          <div className="segmented" role="group" aria-labelledby="pj-scope-label">
            <button type="button" className={scope === 'active' ? 'active' : ''} aria-pressed={scope === 'active'} onClick={() => setScope('active')}>
              Active
            </button>
            <button type="button" className={scope === 'archived' ? 'active' : ''} aria-pressed={scope === 'archived'} onClick={() => setScope('archived')}>
              Archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
            </button>
          </div>
        </div>
      </div>

      <Card flush>
        {loading ? (
          <Skeleton rows={5} />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            title={filtersActive ? 'No projects match your filters' : scope === 'archived' ? 'No archived projects' : 'No projects yet'}
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}>Clear filters</Button>
              ) : scope === 'active' ? (
                <Button onClick={openAdd}>Add your first project</Button>
              ) : undefined
            }
          >
            {filtersActive
              ? 'Try a different search or status.'
              : scope === 'archived'
              ? 'Projects you archive are kept here, out of the way.'
              : 'Projects you create will be listed here.'}
          </EmptyState>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-stack">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th className="num">Invoices</th>
                  <th>Lead</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const projectLead = employees.find((e) => e.id === project.project_lead_id);
                  const isArchived = !!project.archived_at;

                  return (
                    <tr key={project.id} className="is-clickable" onClick={() => setViewingProject(project)}>
                      <td className="cell-strong hide-mobile">{project.serial_number}</td>
                      <td className="cell-title cell-strong">
                        {project.address}
                        <span className="cell-sub"><span className="mobile-only">#{project.serial_number}{project.company_name ? ' · ' : ''}</span>{project.company_name}</span>
                      </td>
                      <td data-label="Type"><TypeChip type={project.type} /></td>
                      <td data-label="Contact">
                        <div className="cell-stack">
                          {project.contact_person || '–'}
                          {project.email && <span className="cell-sub">{project.email}</span>}
                        </div>
                      </td>
                      <td data-label="Status"><ProjectStatusBadge status={project.status} /></td>
                      <td className="num" data-label="Invoices">{project.invoice_count ?? 0}</td>
                      <td data-label="Lead">{projectLead?.full_name || '–'}</td>
                      <td className="cell-actions" data-label="" onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          label={`Actions for ${project.address || 'project'}`}
                          items={[
                            { label: 'View', onClick: () => setViewingProject(project) },
                            { label: 'Edit', onClick: () => setEditingProject(project) },
                            { label: 'Archive', hidden: isArchived, onClick: () => setConfirm({ kind: 'archive', project }) },
                            { label: 'Restore', hidden: !isArchived, onClick: () => setConfirm({ kind: 'restore', project }) },
                            { label: 'Delete permanently', danger: true, hidden: !isArchived, onClick: () => setConfirm({ kind: 'delete', project }) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && filteredProjects.length > 0 && (
        <p className="text-muted mt-3 mb-0">
          Showing {filteredProjects.length} of {inScope.length} {scope === 'archived' ? 'archived ' : ''}projects
        </p>
      )}

      {(showAddProject || editingProject) && (
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
            toast.success('Project saved');
            onRefresh();
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'archive' ? 'Archive this project?'
              : confirm.kind === 'restore' ? 'Restore this project?'
              : 'Delete this project permanently?'
          }
          tone={confirm.kind === 'delete' ? 'danger' : 'primary'}
          confirmLabel={confirm.kind === 'archive' ? 'Archive' : confirm.kind === 'restore' ? 'Restore' : 'Delete permanently'}
          busy={busy}
          onConfirm={runConfirmed}
          onCancel={() => setConfirm(null)}
        >
          <p><strong>#{confirm.project.serial_number} · {confirm.project.address}</strong></p>
          {confirm.kind === 'archive' && (
            <p>It will be hidden from the project list and from the time-entry picker. Existing time entries are kept, and you can restore it at any time.</p>
          )}
          {confirm.kind === 'restore' && <p>It will appear in the active project list again.</p>}
          {confirm.kind === 'delete' && (
            <p>This permanently deletes the project <strong>and every time entry logged to it</strong>. This can&apos;t be undone. If you just want it out of the way, keep it archived instead.</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
};

export default ProjectsTab;
