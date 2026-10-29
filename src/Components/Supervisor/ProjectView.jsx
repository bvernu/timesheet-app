import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Card from '../Common/Card';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import { ProjectStatusBadge, TypeChip } from '../Common/StatusBadge';
import { useToast } from '../Common/Toast';
import ExpandableText from '../Common/ExpandableText';
import { dayOffset, formatDate, formatTime, hours } from '../../utils/format';

const money = (value) =>
  `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const hasValue = (v) => v !== null && v !== undefined && v !== '';

const Detail = ({ label, children }) => (
  <>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </>
);

const ProjectView = ({ project, onClose, onEdit, employees, onRefresh, viewerRole = 'supervisor' }) => {
  const toast = useToast();
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceCount, setInvoiceCount] = useState(project.invoice_count ?? 0);
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    loadProjectTimeEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, viewerRole]);

  const loadProjectTimeEntries = async () => {
    if (viewerRole === 'supervisor') {
      // Supervisors may read every time entry in their company, notes included
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
    } else {
      // Managers can't read other people's time entries directly. This database function returns only who
      // worked on the project and when (no notes, mileage or approval details).
      const { data } = await supabase.rpc('project_time_entries', { p_project_id: project.id });

      if (data) {
        setTimeEntries(
          data.map((row) => ({
            id: row.id,
            employee_id: row.employee_id,
            clock_in: row.clock_in,
            clock_out: row.clock_out,
            notes: null,
            profiles: { full_name: row.employee_name },
          }))
        );
      }
    }
    setLoading(false);
  };

  const changeInvoiceCount = async (delta) => {
    const next = invoiceCount + delta;
    if (next < 0) return;
    setSavingInvoice(true);
    const { error } = await supabase.from('projects').update({ invoice_count: next }).eq('id', project.id);
    setSavingInvoice(false);
    if (error) {
      toast.error(`Couldn't update the invoice count: ${error.message}`);
      return;
    }
    setInvoiceCount(next);
    onRefresh?.();
  };

  // Calculate hours by employee
  const employeeHoursBreakdown = {};

  timeEntries.forEach((entry) => {
    if (entry.clock_out) {
      const entryHours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
      const employeeName = entry.profiles?.full_name || 'Unknown';
      const employeeId = entry.employee_id;

      if (!employeeHoursBreakdown[employeeId]) {
        employeeHoursBreakdown[employeeId] = { name: employeeName, hours: 0, entries: [] };
      }

      employeeHoursBreakdown[employeeId].hours += entryHours;
      employeeHoursBreakdown[employeeId].entries.push(entry);
    }
  });

  const totalProjectHours = Object.values(employeeHoursBreakdown).reduce((sum, emp) => sum + emp.hours, 0);
  const projectLead = employees.find((e) => e.id === project.project_lead_id);

  const hasContact = project.contact_person || project.company_name || project.email || project.phone;
  const hasFinancial = hasValue(project.quotation_amount) || hasValue(project.invoice_amount) || hasValue(project.payment_amount);

  return (
    <div>
      <div className="mb-2">
        <Button variant="quiet" size="sm" onClick={onClose}>← Projects</Button>
      </div>

      <PageHeader
        title={project.address}
        subtitle={`Project #${project.serial_number}`}
        actions={<Button onClick={onEdit}>Edit project</Button>}
      />

      <Card>
        <div className="row g-4">
          <div className="col-md-6">
            <h4 className="section-title">Overview</h4>
            <dl className="detail-list">
              <Detail label="Type"><TypeChip type={project.type} /></Detail>
              <Detail label="Status"><ProjectStatusBadge status={project.status} /></Detail>
              <Detail label="Project lead">{projectLead?.full_name || '–'}</Detail>
              <Detail label="Invoices">
                <span className="d-inline-flex align-items-center gap-2">
                  <Button variant="secondary" size="sm" aria-label="Decrease invoice count" onClick={() => changeInvoiceCount(-1)} disabled={savingInvoice || invoiceCount <= 0}>−</Button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{invoiceCount}</span>
                  <Button variant="secondary" size="sm" aria-label="Increase invoice count" onClick={() => changeInvoiceCount(1)} disabled={savingInvoice}>+</Button>
                </span>
              </Detail>
              {project.job_description && <Detail label="Description">{project.job_description}</Detail>}
              {project.notes && <Detail label="Notes">{project.notes}</Detail>}
            </dl>
          </div>

          <div className="col-md-6">
            {hasContact && (
              <>
                <h4 className="section-title">Contact</h4>
                <dl className="detail-list">
                  {project.contact_person && <Detail label="Person">{project.contact_person}</Detail>}
                  {project.company_name && <Detail label="Company">{project.company_name}</Detail>}
                  {project.email && <Detail label="Email"><a href={`mailto:${project.email}`}>{project.email}</a></Detail>}
                  {project.phone && <Detail label="Phone"><a href={`tel:${project.phone}`}>{project.phone}</a></Detail>}
                </dl>
              </>
            )}
            {hasFinancial && (
              <>
                <h4 className={`section-title${hasContact ? ' mt-4' : ''}`}>Financials</h4>
                <dl className="detail-list">
                  {hasValue(project.quotation_amount) && (
                    <Detail label="Quotation">
                      {money(project.quotation_amount)}
                      {project.quotation_date && <span className="text-muted"> · {formatDate(project.quotation_date)}</span>}
                    </Detail>
                  )}
                  {hasValue(project.invoice_amount) && (
                    <Detail label="Invoice">
                      {money(project.invoice_amount)}
                      {project.invoice_date && <span className="text-muted"> · {formatDate(project.invoice_date)}</span>}
                    </Detail>
                  )}
                  {hasValue(project.payment_amount) && (
                    <Detail label="Payment">
                      {money(project.payment_amount)}
                      {project.payment_date && <span className="text-muted"> · {formatDate(project.payment_date)}</span>}
                    </Detail>
                  )}
                </dl>
              </>
            )}
            {!hasContact && !hasFinancial && (
              <p className="text-muted mb-0">No contact or financial details yet. Use “Edit project” to add them.</p>
            )}
          </div>
        </div>
      </Card>

      <div className="stat-row mt-4">
        <div className="stat">
          <div className="stat-label">Total hours</div>
          <div className="stat-value">{hours(totalProjectHours)}<span className="stat-unit">h</span></div>
        </div>
        <div className="stat">
          <div className="stat-label">Contributors</div>
          <div className="stat-value">{Object.keys(employeeHoursBreakdown).length}</div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <Card title="Hours by employee">
            {Object.keys(employeeHoursBreakdown).length === 0 ? (
              <p className="text-muted text-center py-3 mb-0">No hours logged yet</p>
            ) : (
              Object.entries(employeeHoursBreakdown)
                .sort(([, a], [, b]) => b.hours - a.hours)
                .map(([employeeId, data]) => (
                  <div key={employeeId} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="fw-medium">{data.name}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{hours(data.hours)} h</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(data.hours / totalProjectHours) * 100}%` }} />
                    </div>
                    <small className="text-muted">{data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'}</small>
                  </div>
                ))
            )}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title="Time entries" flush>
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {loading ? (
                <p className="text-center text-muted py-4 mb-0">Loading…</p>
              ) : timeEntries.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0">No time entries yet</p>
              ) : (
                <ul className="list-plain">
                  {timeEntries.map((entry) => {
                    const clockOut = entry.clock_out;
                    const entryHrs = clockOut ? (new Date(clockOut) - new Date(entry.clock_in)) / 3600000 : null;
                    const offset = dayOffset(entry.clock_in, clockOut);
                    return (
                      <li key={entry.id}>
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="fw-medium">{entry.profiles?.full_name || 'Unknown'}</div>
                            <div className="text-muted small">
                              {formatDate(entry.clock_in)} · {formatTime(entry.clock_in)} → {clockOut ? formatTime(clockOut) : 'Ongoing'}
                              {offset > 0 && <span className="day-offset">+{offset} day{offset > 1 ? 's' : ''}</span>}
                            </div>
                            {entry.notes?.trim() && <div className="small mt-1"><ExpandableText text={entry.notes} /></div>}
                          </div>
                          <span className="fw-medium" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {entryHrs === null ? 'Ongoing' : `${hours(entryHrs)} h`}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;
