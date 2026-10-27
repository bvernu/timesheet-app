// Tests for the employee timesheet screen.
// These are not run by `npm run build`. To run them:
//   npm i -D vitest jsdom @testing-library/react @testing-library/user-event
//   npx vitest run --environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeeDashboard from './EmployeeDashboard';
import { ToastProvider } from '../Common/Toast';

const state = vi.hoisted(() => ({ entries: [], projects: [], deleted: [] }));

vi.mock('../../supabaseClient', () => {
  // Minimal stand-in for the query builder: every method returns the builder, and awaiting it yields the rows.
  const builder = (table) => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      delete: () => { q.isDelete = true; return q; },
      then: (resolve) => {
        if (q.isDelete) state.deleted.push(table);
        const data = table === 'projects' ? state.projects : state.entries;
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return q;
  };
  return { supabase: { from: builder } };
});

const profile = { id: '123', full_name: 'John Doe' };
const entry = (over = {}) => ({
  id: '1',
  employee_id: '123',
  project_id: '1',
  clock_in: '2024-01-15T09:00:00',
  clock_out: '2024-01-15T17:00:00',
  mileage: 50,
  notes: 'Test entry',
  approved: false,
  projects: { name: 'Project A' },
  ...over,
});

const renderDashboard = () =>
  render(
    <ToastProvider>
      <EmployeeDashboard profile={profile} />
    </ToastProvider>
  );

describe('EmployeeDashboard', () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.entries = [entry()];
    state.projects = [{ id: '1', name: 'Project A' }, { id: '2', name: 'Project B' }];
    state.deleted = [];
  });

  it('shows the page title and an Add time entry button', async () => {
    renderDashboard();
    expect(screen.getByText('My timesheet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add time entry' })).toBeTruthy();
  });

  it('lists time entries', async () => {
    renderDashboard();
    expect(await screen.findByText('Project A')).toBeTruthy();
    expect(screen.getByText('Test entry')).toBeTruthy();
  });

  it('shows an empty state when there are no entries', async () => {
    state.entries = [];
    renderDashboard();
    expect(await screen.findByText('No time entries yet')).toBeTruthy();
  });

  it('calculates net hours (total minus the unpaid break)', async () => {
    renderDashboard();
    await screen.findByText('Project A');
    // 8h shift -> 0.5h break -> 7.5h net
    expect(screen.getAllByText('7.50').length).toBeGreaterThan(0);
  });

  it('opens the Add time entry dialog', async () => {
    renderDashboard();
    await screen.findByText('Project A');
    await userEvent.click(screen.getByRole('button', { name: 'Add time entry' }));
    expect(within(await screen.findByRole('dialog')).getByText('Add time entry')).toBeTruthy();
  });

  it('asks for confirmation before deleting an entry', async () => {
    renderDashboard();
    await screen.findByText('Project A');
    await userEvent.click(screen.getByRole('button', { name: /actions for project a/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(state.deleted).toHaveLength(0); // nothing deleted yet
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete entry' }));
    await waitFor(() => expect(state.deleted).toEqual(['time_entries']));
  });

  it('locks approved entries (no actions menu)', async () => {
    state.entries = [entry({ approved: true, approved_at: '2024-01-16T10:00:00' })];
    renderDashboard();
    await screen.findByText('Project A');
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /actions for/i })).toBeNull();
  });
});
