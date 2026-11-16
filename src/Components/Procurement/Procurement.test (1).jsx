import '@testing-library/jest-dom/vitest';
// Tests for the supplier / client-invoice / profit features and for time entries linked to several projects.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, log, reset, rpcHandlers, failures } from '../../test/fakeSupabase';
import { ToastProvider } from '../Common/Toast';
import ProjectView from '../Supervisor/ProjectView';
import ProjectForm from '../Supervisor/ProjectForm';
import TimeEntryForm from '../Employee/TimeEntryForm';
import { entryProjects, entryProjectLabel } from '../../utils/entryProjects';
import { cents, money, sum } from '../../utils/money';

const tenant = vi.hoisted(() => ({ current: { id: 'T1', name: 'Co', settings: {} } }));
vi.mock('../../tenant/TenantContext', () => ({ useTenant: () => tenant.current }));
vi.mock('../../supabaseClient', async () => ({ supabase: (await import('../../test/fakeSupabase')).supabase }));

const PROCUREMENT = { procurement: true, entryFields: { project: true, multiProject: true, mileage: false }, autoBreak: false };
const project = { id: 'P1', serial_number: 7, address: 'Laundry Room 1', name: 'Laundry Room 1', type: 'Laundry room', company_name: 'Globex', contact_person: 'Bob', status: 'in progress' };

const wrap = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => { tenant.current = { id: 'T1', name: 'Co', settings: PROCUREMENT }; });
afterEach(cleanup);

describe('money helpers', () => {
  it('sums text amounts, ignoring blanks, and rounds to cents', () => {
    expect(sum([{ a: '1000.00' }, { a: null }, { a: 250.5 }], (r) => r.a)).toBe(1250.5);
    expect(cents(0.1 + 0.2)).toBe(0.3);
    expect(money(1234.5)).toBe('$1,234.50');
  });
});

describe('entryProjects', () => {
  it('reads one project, several projects, or none', () => {
    expect(entryProjects({ project_id: 'a', projects: { name: 'A' } })).toEqual([{ id: 'a', name: 'A' }]);
    expect(entryProjectLabel({ time_entry_projects: [{ project_id: 'a', projects: { name: 'A' } }, { project_id: 'b', projects: { name: 'B' } }] })).toBe('A, B');
    expect(entryProjects({})).toEqual([]);
  });
});

describe('settings', () => {
  it('only an explicit true switches procurement / multiProject on', async () => {
    const { resolveSettings } = await import('../../tenant/settings');
    expect(resolveSettings({ settings: {} })).toMatchObject({ procurement: false, multiProject: false, projectField: true });
    expect(resolveSettings({ settings: PROCUREMENT })).toMatchObject({ procurement: true, multiProject: true, mileageField: false, autoBreak: false });
    expect(resolveSettings({ settings: { procurement: 'yes' } }).procurement).toBe(false);
  });
});

describe('ProjectView (procurement company)', () => {
  const seed = () => reset({
    suppliers: [{ id: 'S1', name: 'Acme Steel' }, { id: 'S2', name: 'Bolt Co' }],
    project_suppliers: [
      { id: 'O1', project_id: 'P1', supplier_id: 'S1', location: 'Toronto', items: 'Beams', invoice_amount: '1000.00', status: 'ordered', order_number: 'PO-1' },
      { id: 'O2', project_id: 'P1', supplier_id: 'S2', location: 'Ottawa', items: 'Bolts', invoice_amount: '250.50', status: 'in transit' },
    ],
    client_invoices: [
      { id: 'I1', project_id: 'P1', invoice_number: 'INV-1', amount: '2000.00', sent_date: '2026-11-01' },
      { id: 'I2', project_id: 'P1', invoice_number: 'INV-2', amount: '500.00', sent_date: '2026-11-10' },
    ],
    client_payments: [
      { id: 'Y1', invoice_id: 'I1', amount: '800.00', payment_date: '2026-11-05' },
      { id: 'Y2', invoice_id: 'I1', amount: '200.00', payment_date: '2026-11-08' },
    ],
    time_entries: [],
    time_entry_projects: [],
  });

  it('shows supplier total, client total, profit, outstanding and each invoice balance', async () => {
    seed();
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    const stats = await screen.findByLabelText('Project financials');
    expect(within(stats).getByText('Client invoiced').nextSibling).toHaveTextContent('$2,500.00');
    expect(within(stats).getByText('Supplier invoiced').nextSibling).toHaveTextContent('$1,250.50');
    expect(within(stats).getByText('Profit').nextSibling).toHaveTextContent('$1,249.50');
    expect(within(stats).getByText('Outstanding balance').nextSibling).toHaveTextContent('$1,500.00');
    const invoices = screen.getByText('Client invoices').closest('section');
    const inv1 = within(invoices).getByText('INV-1').closest('tr');
    expect(inv1).toHaveTextContent('$2,000.00');
    expect(inv1).toHaveTextContent('$1,000.00'); // paid 1,000 -> balance 1,000
    const inv2 = within(invoices).getByText('INV-2').closest('tr');
    expect(inv2).toHaveTextContent('$500.00');
  });

  it('lists each supplier with its order details', async () => {
    seed();
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    const row = (await screen.findByText('Acme Steel')).closest('tr');
    expect(row).toHaveTextContent('Toronto');
    expect(row).toHaveTextContent('Beams');
    expect(row).toHaveTextContent('Ordered');
    expect(row).toHaveTextContent('PO-1');
  });

  it('turns a fully paid invoice into "Paid" and a negative profit stays visible', async () => {
    seed();
    db.client_payments.push({ id: 'Y3', invoice_id: 'I2', amount: '500.00', payment_date: '2026-11-12' });
    db.project_suppliers[0].invoice_amount = '9000.00';
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    await screen.findByLabelText('Project financials');
    const inv2 = within(screen.getByText('Client invoices').closest('section')).getByText('INV-2').closest('tr');
    expect(inv2).toHaveTextContent('Paid');
    const stats = screen.getByLabelText('Project financials');
    expect(within(stats).getByText('Profit').nextSibling).toHaveTextContent('-$6,750.50');
  });

  it('records a payment against an invoice and the balance drops', async () => {
    seed();
    const user = userEvent.setup();
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    await screen.findByLabelText('Project financials');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await user.type(await screen.findByLabelText(/Amount/), '300');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(db.client_payments).toHaveLength(3));
    expect(db.client_payments[2]).toMatchObject({ amount: 300 });
    await waitFor(() => expect(screen.getByLabelText('Project financials')).toHaveTextContent('$1,200.00'));
  });

  it('does not show supplier or invoice sections for an ordinary company', async () => {
    tenant.current = { id: 'T1', name: 'Co', settings: {} };
    seed();
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    await screen.findByText('Hours by employee');
    expect(screen.queryByText('Suppliers')).toBeNull();
    expect(screen.queryByLabelText('Project financials')).toBeNull();
    expect(log.some((l) => l.table === 'project_suppliers')).toBe(false);
  });

  it('counts an entry shared by two projects as half its hours on each', async () => {
    seed();
    db.profiles = [];
    db.time_entries = [
      { id: 'E1', employee_id: 'U1', project_id: null, clock_in: '2026-11-10T09:00:00', clock_out: '2026-11-10T17:00:00', time_entry_projects: [{ project_id: 'P1' }, { project_id: 'P2' }], profiles: { full_name: 'Eve' } },
      { id: 'E2', employee_id: 'U1', project_id: 'P1', clock_in: '2026-11-11T09:00:00', clock_out: '2026-11-11T13:00:00', time_entry_projects: [], profiles: { full_name: 'Eve' } },
    ];
    db.time_entry_projects = [{ time_entry_id: 'E1', project_id: 'P1' }, { time_entry_id: 'E1', project_id: 'P2' }];
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    // 8h shared by 2 = 4h, plus 4h on its own = 8h
    const totalHours = (await screen.findByText('Total hours')).nextSibling;
    await waitFor(() => expect(totalHours).toHaveTextContent('8.00'));
  });

  it('manager hours use the project_count from the database function', async () => {
    seed();
    rpcHandlers.project_time_entries = () => ({ data: [
      { id: 'E1', employee_id: 'U1', employee_name: 'Eve', clock_in: '2026-11-10T09:00:00', clock_out: '2026-11-10T17:00:00', project_count: 4 },
    ], error: null });
    wrap(<ProjectView project={project} employees={[]} viewerRole="manager" onClose={() => {}} onEdit={() => {}} />);
    const totalHours = (await screen.findByText('Total hours')).nextSibling;
    await waitFor(() => expect(totalHours).toHaveTextContent('2.00'));
  });
});

describe('ProjectForm - creating a project (procurement company)', () => {
  const setup = async () => {
    reset({ suppliers: [{ id: 'S1', name: 'Acme Steel' }], projects: [], project_suppliers: [] });
    const onSave = vi.fn();
    const user = userEvent.setup();
    wrap(<ProjectForm project={null} employees={[]} nextSerialNumber={8} typeSuggestions={['Laundry room']} onClose={() => {}} onSave={onSave} />);
    await user.type(screen.getByLabelText(/Project name/), 'Boardroom fit-out');
    await user.type(screen.getByLabelText(/Project type/), 'Conference room');
    await user.type(screen.getByLabelText(/Contact person/), 'Bob');
    return { user, onSave };
  };

  it('uses the renamed labels and a free-text project type', async () => {
    await setup();
    expect(screen.getByLabelText(/Client name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Company name/)).toBeNull();
    expect(screen.getByLabelText(/Project type/).tagName).toBe('INPUT');
    expect(screen.getByLabelText(/Project type/)).toHaveValue('Conference room');
    expect(screen.queryByText(/^Invoice$/)).toBeNull();
  });

  it('requires at least one supplier', async () => {
    const { user, onSave } = await setup();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one supplier');
    expect(db.projects).toHaveLength(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires items and location for each supplier', async () => {
    const { user } = await setup();
    await user.selectOptions(screen.getByLabelText('Add a supplier'), 'S1');
    // the browser itself stops an empty submit on these two fields...
    expect(screen.getByLabelText(/Items/)).toBeRequired();
    expect(screen.getByLabelText(/Location/)).toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(db.projects).toHaveLength(0);
    // ...and blank-looking text (spaces only) is caught by our own check with a clear message
    await user.type(screen.getByLabelText(/Items/), '   ');
    await user.type(screen.getByLabelText(/Location/), 'Toronto');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Items are required for Acme Steel');
    await user.type(screen.getByLabelText(/Items/), 'Beams');
    await user.clear(screen.getByLabelText(/Location/));
    await user.type(screen.getByLabelText(/Location/), '  ');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Location is required for Acme Steel');
    expect(db.projects).toHaveLength(0);
  });

  it('saves the project and its suppliers, picking several from the list and creating a new one', async () => {
    const { user, onSave } = await setup();
    await user.selectOptions(screen.getByLabelText('Add a supplier'), 'S1');
    await user.selectOptions(screen.getByLabelText('Add a supplier'), '__new');
    await user.type(screen.getByLabelText('New supplier name'), 'Bolt Co');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Bolt Co')).toBeInTheDocument();
    const items = screen.getAllByLabelText(/Items/);
    const locations = screen.getAllByLabelText(/Location/);
    await user.type(items[0], 'Beams'); await user.type(locations[0], 'Toronto');
    await user.type(items[1], 'Bolts'); await user.type(locations[1], 'Ottawa');
    await user.type(screen.getAllByLabelText(/Invoice amount/)[0], '1200');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(db.projects).toHaveLength(1);
    expect(db.projects[0]).toMatchObject({ name: 'Boardroom fit-out', type: 'Conference room' });
    expect(db.projects[0]).not.toHaveProperty('invoice_amount');
    expect(db.project_suppliers).toHaveLength(2);
    expect(db.project_suppliers[0]).toMatchObject({ project_id: db.projects[0].id, supplier_id: 'S1', items: 'Beams', location: 'Toronto', invoice_amount: 1200, status: 'quote requested' });
    expect(db.suppliers.map((s) => s.name)).toContain('Bolt Co');
  });

  it('removes the new project again if its suppliers cannot be saved', async () => {
    const { user, onSave } = await setup();
    await user.selectOptions(screen.getByLabelText('Add a supplier'), 'S1');
    await user.type(screen.getByLabelText(/Items/), 'Beams');
    await user.type(screen.getByLabelText(/Location/), 'Toronto');
    failures['project_suppliers.insert'] = 'boom';
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not created');
    expect(db.projects).toHaveLength(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('uploads a chosen invoice PDF after the project exists and stores its path', async () => {
    const { user, onSave } = await setup();
    await user.selectOptions(screen.getByLabelText('Add a supplier'), 'S1');
    await user.type(screen.getByLabelText(/Items/), 'Beams');
    await user.type(screen.getByLabelText(/Location/), 'Toronto');
    await user.upload(screen.getByLabelText('Invoice PDF'), new File(['%PDF'], 'inv 1.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const up = log.find((l) => l.upload);
    expect(up.upload).toMatch(new RegExp(`^T1/${db.projects[0].id}/.+-inv_1\\.pdf$`));
    expect(db.project_suppliers[0].invoice_pdf_path).toBe(up.upload);
  });
});

describe('ProjectForm - ordinary company is unchanged', () => {
  it('keeps the address / company wording, fixed types, and no supplier section', async () => {
    tenant.current = { id: 'T1', name: 'Co', settings: {} };
    reset({ projects: [] });
    wrap(<ProjectForm project={null} employees={[]} nextSerialNumber={1} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/Address \(project title\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Type/ })).toBeInTheDocument();
    expect(screen.queryByText('Suppliers')).toBeNull();
  });
});

describe('TimeEntryForm - several projects', () => {
  const projects = [{ id: 'P1', name: 'Alpha', serial_number: 1 }, { id: 'P2', name: 'Beta', serial_number: 2 }, { id: 'P3', name: 'Gamma', serial_number: 3 }];
  const fill = async (user) => {
    await user.type(screen.getByLabelText(/Clock in/), '2026-11-16T09:00');
    await user.type(screen.getByLabelText(/Clock out/), '2026-11-16T17:00');
  };

  it('will not save without at least one project', async () => {
    reset();
    const user = userEvent.setup();
    wrap(<TimeEntryForm profile={{ id: 'U1' }} projects={projects} onClose={() => {}} onSave={() => {}} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one project');
    expect(log.some((l) => l.rpc)).toBe(false);
  });

  it('saves the entry and every ticked project in one call; mileage and break fields stay off', async () => {
    reset();
    const onSave = vi.fn();
    const user = userEvent.setup();
    wrap(<TimeEntryForm profile={{ id: 'U1' }} projects={projects} onClose={() => {}} onSave={onSave} />);
    expect(screen.queryByLabelText(/Mileage/)).toBeNull();
    await fill(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Gamma'));
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const call = log.find((l) => l.rpc === 'save_time_entry');
    expect(call.args.p_project_ids.sort()).toEqual(['P1', 'P3']);
    expect(call.args.p_entry_id).toBeNull();
    expect(call.args.p_set_mileage).toBe(false);
    expect(log.some((l) => l.table === 'time_entries')).toBe(false);
  });

  it('pre-ticks the projects of the entry being edited, and can search the list', async () => {
    reset();
    const user = userEvent.setup();
    const editing = { id: 'E1', clock_in: '2026-11-16T09:00:00', clock_out: '2026-11-16T17:00:00', notes: '', approved: false, project_id: null, time_entry_projects: [{ project_id: 'P2', projects: { name: 'Beta' } }] };
    wrap(<TimeEntryForm profile={{ id: 'U1' }} projects={projects} editingEntry={editing} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByLabelText('Beta')).toBeChecked();
    expect(screen.getByLabelText('Alpha')).not.toBeChecked();
    await user.type(screen.getByLabelText('Search projects'), 'gam');
    expect(screen.queryByLabelText('Alpha')).toBeNull();
    expect(screen.getByLabelText('Gamma')).toBeInTheDocument();
  });

  it('a company without multi-project still uses the single project drop-down', async () => {
    tenant.current = { id: 'T1', name: 'Co', settings: {} };
    reset();
    wrap(<TimeEntryForm profile={{ id: 'U1' }} projects={projects} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('combobox', { name: /Project/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Search projects')).toBeNull();
  });
});
