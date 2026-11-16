import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimesheetsTab from './TimesheetsTab';
import { ToastProvider } from '../Common/Toast';

vi.mock('../../tenant/TenantContext', () => ({ useTenant: () => ({ id: 'T1', name: 'Co', settings: {} }) }));
vi.mock('../../supabaseClient', async () => ({ supabase: (await import('../../test/fakeSupabase')).supabase }));

const today = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const entries = [
  { id: 'a', employee_id: 'U1', clock_in: today(1), clock_out: today(2), approved: false, projects: { name: 'Alpha' }, project_id: 'P1', profiles: { full_name: 'Pending Pat' } },
  { id: 'b', employee_id: 'U2', clock_in: today(1), clock_out: today(2), approved: true, approved_at: today(3), projects: { name: 'Alpha' }, project_id: 'P1', profiles: { full_name: 'Approved Ann' } },
];

describe('TimesheetsTab default filter', () => {
  afterEach(cleanup);

  it('opens on "All" so approved and pending entries both show', () => {
    render(<ToastProvider><TimesheetsTab timeEntries={entries} employees={[]} /></ToastProvider>);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Pending Pat')).toBeInTheDocument();
    expect(table.getByText('Approved Ann')).toBeInTheDocument();
  });

  it('the Pending and Approved filters still narrow the list', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><TimesheetsTab timeEntries={entries} employees={[]} /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: 'Pending' }));
    expect(within(screen.getByRole('table')).queryByText('Approved Ann')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Approved' }));
    expect(within(screen.getByRole('table')).queryByText('Pending Pat')).toBeNull();
    expect(within(screen.getByRole('table')).getByText('Approved Ann')).toBeInTheDocument();
  });

  it('multi-project entries list every project name', () => {
    const multi = [{ ...entries[0], project_id: null, projects: null, time_entry_projects: [{ project_id: 'P1', projects: { name: 'Alpha' } }, { project_id: 'P2', projects: { name: 'Beta' } }] }];
    render(<ToastProvider><TimesheetsTab timeEntries={multi} employees={[]} /></ToastProvider>);
    expect(within(screen.getByRole('table')).getByText('Alpha, Beta')).toBeInTheDocument();
  });
});
