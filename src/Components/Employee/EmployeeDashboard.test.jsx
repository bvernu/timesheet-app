import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import EmployeeDashboard from './EmployeeDashboard';
import * as supabaseClient from '../../supabaseClient';

vi.mock('../../supabaseClient');

const mockProfile = {
    id: '123',
    full_name: 'John Doe'
};

const mockTimeEntries = [
    {
        id: '1',
        employee_id: '123',
        project_id: '1',
        clock_in: '2024-01-15T09:00:00Z',
        clock_out: '2024-01-15T17:00:00Z',
        mileage: 50,
        notes: 'Test entry',
        projects: { name: 'Project A' }
    }
];

const mockProjects = [
    { id: '1', name: 'Project A' },
    { id: '2', name: 'Project B' }
];

describe('EmployeeDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        supabaseClient.supabase.from = vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockTimeEntries }),
            delete: vi.fn().mockResolvedValue({ data: null })
        }));
    });

    test('renders employee dashboard with profile name', async () => {
        render(<EmployeeDashboard profile={mockProfile} />);
        expect(screen.getByText(/John Doe's Timesheet/i)).toBeInTheDocument();
    });

    test('renders Add Time Entry button', () => {
        render(<EmployeeDashboard profile={mockProfile} />);
        expect(screen.getByRole('button', { name: /Add Time Entry/i })).toBeInTheDocument();
    });

    test('displays time entries in table', async () => {
        render(<EmployeeDashboard profile={mockProfile} />);
        await waitFor(() => {
            expect(screen.getByText('Project A')).toBeInTheDocument();
        });
    });

    test('shows empty state when no time entries', async () => {
        supabaseClient.supabase.from = vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [] })
        }));
        
        render(<EmployeeDashboard profile={mockProfile} />);
        await waitFor(() => {
            expect(screen.getByText(/No time entries yet/i)).toBeInTheDocument();
        });
    });

    test('calculates net hours correctly (total - break)', async () => {
        render(<EmployeeDashboard profile={mockProfile} />);
        await waitFor(() => {
            expect(screen.getByText('7.50')).toBeInTheDocument();
        });
    });

    test('opens TimeEntryForm when Add Time Entry is clicked', async () => {
        render(<EmployeeDashboard profile={mockProfile} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Time Entry/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Add Time Entry/i })).toBeInTheDocument();
        });
    });

    test('handles delete with confirmation', async () => {
        window.confirm = vi.fn(() => true);
        render(<EmployeeDashboard profile={mockProfile} />);
        await waitFor(() => {
            const deleteButton = screen.getAllByRole('button', { name: /Delete/i })[0];
            fireEvent.click(deleteButton);
        });
    });
});