import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { log, reset, rpcHandlers } from '../../test/fakeSupabase';
import { ToastProvider } from '../Common/Toast';
import TimeEntryForm from './TimeEntryForm';
import ProjectView from '../Supervisor/ProjectView';
import { parseDuration, formatDuration, splitEvenly } from '../../utils/duration';
import { entryProjectLabel, projectShare } from '../../utils/entryProjects';
import { resolveSettings } from '../../tenant/settings';

const tenant = vi.hoisted(() => ({ current: null }));
vi.mock('../../tenant/TenantContext', () => ({ useTenant: () => tenant.current }));
vi.mock('../../supabaseClient', async () => ({ supabase: (await import('../../test/fakeSupabase')).supabase }));

const SETTINGS = { procurement: true, entryFields: { project: true, multiProject: true, projectHours: true, mileage: false }, autoBreak: false };
const projects = [{ id: 'P1', name: 'Alpha', serial_number: 1 }, { id: 'P2', name: 'Beta', serial_number: 2 }, { id: 'P3', name: 'Gamma', serial_number: 3 }];
const wrap = (ui) => render(<ToastProvider>{ui}</ToastProvider>);
beforeEach(() => { tenant.current = { id: 'T1', name: 'Co', settings: SETTINGS }; reset(); });
afterEach(cleanup);

describe('duration helpers', () => {
  it('reads the ways people type a length of time', () => {
    const cases = { '2.5': 150, '2,5': 150, '2:30': 150, '0:45': 45, '2h': 120, '2h30': 150, '2h 30m': 150, '2 h 30 min': 150, '90m': 90, '1.25h': 75, '3': 180 };
    for (const [text, minutes] of Object.entries(cases)) expect(parseDuration(text), text).toBe(minutes);
    for (const bad of ['', '  ', 'abc', '2:75', '-1', '1h x']) expect(parseDuration(bad), bad).toBeNull();
  });
  it('shows minutes the way people say them', () => {
    expect(formatDuration(150)).toBe('2h 30m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(0)).toBe('0m');
  });
  it('splits evenly and always adds up', () => {
    expect(splitEvenly(480, 3)).toEqual([160, 160, 160]);
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    for (const [t, n] of [[7, 3], [1, 4], [481, 5]]) expect(splitEvenly(t, n).reduce((a, b) => a + b, 0)).toBe(t);
  });
});

describe('settings + shares', () => {
  it('projectHours needs multiProject and an explicit true', () => {
    expect(resolveSettings({ settings: SETTINGS }).projectHours).toBe(true);
    expect(resolveSettings({ settings: { entryFields: { projectHours: true } } }).projectHours).toBe(false);
    expect(resolveSettings({ settings: { entryFields: { multiProject: true } } }).projectHours).toBe(false);
  });
  it('uses the minutes when every project has them, otherwise splits equally', () => {
    const links = [{ project_id: 'a', minutes: 300 }, { project_id: 'b', minutes: 180 }];
    expect(projectShare(links, 'a')).toBeCloseTo(300 / 480);
    expect(projectShare([{ project_id: 'a', minutes: 300 }, { project_id: 'b', minutes: null }], 'a')).toBe(0.5);
    expect(projectShare([], 'a')).toBe(1);
  });
  it('labels show the time for each project', () => {
    expect(entryProjectLabel({ time_entry_projects: [{ project_id: 'a', minutes: 300, projects: { name: 'A' } }, { project_id: 'b', minutes: 150, projects: { name: 'B' } }] })).toBe('A (5h), B (2h 30m)');
  });
});

describe('TimeEntryForm - time on each project', () => {
  const open = async (editing) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    wrap(<TimeEntryForm profile={{ id: 'U1' }} projects={projects} editingEntry={editing} onClose={() => {}} onSave={onSave} />);
    return { user, onSave };
  };
  const times = async (user, out = '2026-11-16T17:00') => {
    await user.type(screen.getByLabelText(/Clock in/), '2026-11-16T09:00');
    if (out) await user.type(screen.getByLabelText(/Clock out/), out);
  };
  const save = (user) => user.click(screen.getByRole('button', { name: 'Add entry' }));

  it('does not show the panel for a single project, and sends the whole time to it', async () => {
    const { user, onSave } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    expect(screen.queryByText('Time on each project')).toBeNull();
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(log.find((l) => l.rpc).args.p_project_minutes).toEqual([480]);
  });

  it('splits the time evenly at first and follows clock changes', async () => {
    const { user } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    await user.click(screen.getByLabelText('Gamma'));
    expect(screen.getByLabelText('Alpha', { selector: 'input.project-hours-input' })).toHaveValue('2h 40m');
    expect(screen.getByRole('status')).toHaveTextContent('✓ All 8h assigned');
    await user.clear(screen.getByLabelText(/Clock out/));
    await user.type(screen.getByLabelText(/Clock out/), '2026-11-16T15:00');
    expect(screen.getByLabelText('Beta', { selector: 'input.project-hours-input' })).toHaveValue('2h');
  });

  it('shows what is left while typing, fills the rest in one click, and saves minutes per project', async () => {
    const { user, onSave } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    const alpha = screen.getByLabelText('Alpha', { selector: 'input.project-hours-input' });
    const beta = screen.getByLabelText('Beta', { selector: 'input.project-hours-input' });
    await user.clear(alpha); await user.type(alpha, '5');
    await user.clear(beta); await user.type(beta, '2h');
    expect(screen.getByRole('status')).toHaveTextContent('1h left to assign · 7h of 8h');
    await user.click(screen.getByRole('button', { name: /\+ 1h/ }));        // adds the unassigned hour to a project
    expect(screen.getByRole('status')).toHaveTextContent('✓ All 8h assigned');
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const args = log.find((l) => l.rpc).args;
    expect(args.p_project_ids).toEqual(['P1', 'P2']);
    expect(args.p_project_minutes.reduce((a, b) => a + b, 0)).toBe(480);
    expect(args.p_project_minutes).toContain(300);
  });

  it('will not save when the times do not add up, and says by how much', async () => {
    const { user } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    const alpha = screen.getByLabelText('Alpha', { selector: 'input.project-hours-input' });
    const beta = screen.getByLabelText('Beta', { selector: 'input.project-hours-input' });
    await user.clear(alpha); await user.type(alpha, '3');
    expect(beta).toHaveValue('5h');                                 // the untouched box takes what is left
    await user.clear(beta); await user.type(beta, '4');             // now both are typed by hand: 3h + 4h of 8h
    expect(screen.getByRole('status')).toHaveTextContent('1h left to assign');
    await save(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('1h of the 8h is not assigned');
    await user.clear(alpha); await user.type(alpha, '5');
    expect(screen.getByRole('status')).toHaveTextContent('1h too much');
    await save(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('1h more than the 8h worked');
    expect(log.some((l) => l.rpc)).toBe(false);
  });

  it('projects you have not typed in share out whatever is left', async () => {
    const { user, onSave } = await open();
    await times(user);
    for (const n of ['Alpha', 'Beta', 'Gamma']) await user.click(screen.getByLabelText(n));
    const box = (n) => screen.getByLabelText(n, { selector: 'input.project-hours-input' });
    await user.clear(box('Alpha')); await user.type(box('Alpha'), '5');
    expect(box('Beta')).toHaveValue('1h 30m');
    expect(box('Gamma')).toHaveValue('1h 30m');
    await user.clear(box('Beta')); await user.type(box('Beta'), '2.5');
    expect(box('Gamma')).toHaveValue('30m');
    expect(screen.getByRole('status')).toHaveTextContent('✓ All 8h assigned');
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(log.find((l) => l.rpc).args.p_project_minutes).toEqual([300, 150, 30]);
  });

  it('asks for a readable time when a box has text that is not a time', async () => {
    const { user } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    const alpha = screen.getByLabelText('Alpha', { selector: 'input.project-hours-input' });
    await user.clear(alpha); await user.type(alpha, 'lots');
    await save(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter how long you spent on Alpha');
    expect(log.some((l) => l.rpc)).toBe(false);
  });

  it('with no clock out yet: explains, and saves without minutes (equal split)', async () => {
    const { user, onSave } = await open();
    await times(user, null);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    expect(screen.getByText(/divide the time between your projects here/)).toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(log.find((l) => l.rpc).args.p_project_minutes).toBeNull();
  });

  it('editing shows the saved times and keeps them', async () => {
    const editing = { id: 'E1', clock_in: '2026-11-16T09:00:00', clock_out: '2026-11-16T17:00:00', notes: '', approved: false, project_id: null,
      time_entry_projects: [{ project_id: 'P1', minutes: 300, projects: { name: 'Alpha' } }, { project_id: 'P2', minutes: 180, projects: { name: 'Beta' } }] };
    const { user, onSave } = await open(editing);
    expect(screen.getByLabelText('Alpha', { selector: 'input.project-hours-input' })).toHaveValue('5h');
    expect(screen.getByLabelText('Beta', { selector: 'input.project-hours-input' })).toHaveValue('3h');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(log.find((l) => l.rpc).args).toMatchObject({ p_entry_id: 'E1', p_project_minutes: [300, 180] });
  });

  it('"Split evenly" goes back to an even split', async () => {
    const { user } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    const alpha = screen.getByLabelText('Alpha', { selector: 'input.project-hours-input' });
    await user.clear(alpha); await user.type(alpha, '7');
    await user.click(screen.getByRole('button', { name: 'Split evenly' }));
    expect(alpha).toHaveValue('4h');
  });

  it('a company without projectHours keeps the simple list (no time boxes)', async () => {
    tenant.current = { id: 'T1', name: 'Co', settings: { ...SETTINGS, entryFields: { project: true, multiProject: true, mileage: false } } };
    const { user, onSave } = await open();
    await times(user);
    await user.click(screen.getByLabelText('Alpha'));
    await user.click(screen.getByLabelText('Beta'));
    expect(screen.queryByText('Time on each project')).toBeNull();
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(log.find((l) => l.rpc).args).not.toHaveProperty('p_project_minutes');
  });
});

describe('ProjectView uses the hours entered per project', () => {
  const project = { id: 'P1', serial_number: 7, address: 'Alpha', name: 'Alpha', type: 'X', status: 'in progress' };
  it('counts 5h of an 8h entry on this project', async () => {
    reset({ suppliers: [], project_suppliers: [], client_invoices: [], client_payments: [], time_entry_projects: [{ time_entry_id: 'E1', project_id: 'P1' }],
      time_entries: [{ id: 'E1', employee_id: 'U1', project_id: null, clock_in: '2026-11-10T09:00:00', clock_out: '2026-11-10T17:00:00', profiles: { full_name: 'Eve' },
        time_entry_projects: [{ project_id: 'P1', minutes: 300 }, { project_id: 'P2', minutes: 180 }] }] });
    wrap(<ProjectView project={project} employees={[]} onClose={() => {}} onEdit={() => {}} />);
    await waitFor(() => expect(screen.getByText('Total hours').nextSibling).toHaveTextContent('5.00'));
    expect(screen.getByText(/time shared with 1 other project/)).toBeInTheDocument();
  });
  it('managers get the same share from the database function', async () => {
    reset({ suppliers: [], project_suppliers: [], client_invoices: [], client_payments: [] });
    rpcHandlers.project_time_entries = () => ({ data: [{ id: 'E1', employee_id: 'U1', employee_name: 'Eve', clock_in: '2026-11-10T09:00:00', clock_out: '2026-11-10T17:00:00', project_count: 2, project_share: 0.625 }], error: null });
    wrap(<ProjectView project={project} employees={[]} viewerRole="manager" onClose={() => {}} onEdit={() => {}} />);
    await waitFor(() => expect(screen.getByText('Total hours').nextSibling).toHaveTextContent('5.00'));
  });
});
