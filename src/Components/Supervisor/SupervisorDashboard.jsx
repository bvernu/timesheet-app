import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Tabs from '../Common/Tabs';
import EmployeeDashboard from '../Employee/EmployeeDashboard';
import TimesheetsTab from './TimesheetsTab';
import EmployeesTab from './EmployeesTab';
import ProjectsTab from './ProjectsTab';

const SupervisorDashboard = ({ profile }) => {
  const [activeTab, setActiveTab] = useState('timesheets');
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadEmployees(), loadProjects(), loadAllTimeEntries()]).finally(() => setLoading(false));
  }, []);

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    
    if (data) {
      setEmployees(data);
    }
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('serial_number', { ascending: false });
    
    if (data) {
      setProjects(data);
    }
  };

  const loadAllTimeEntries = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        profiles!time_entries_employee_id_fkey (full_name),
        projects!time_entries_project_id_fkey (name)
      `)
      .order('clock_in', { ascending: false });
    
    if (error) {
      console.error('Error loading time entries:', error);
    }
    
    if (data) {
      setTimeEntries(data);
    }
  };

  const tabs = [
    {
      id: 'my-timesheet',
      label: 'My timesheet',
      content: <EmployeeDashboard profile={profile} />
    },
    {
      id: 'timesheets',
      label: 'All timesheets',
      content: <TimesheetsTab timeEntries={timeEntries} employees={employees} loading={loading} />
    },
    {
      id: 'employees',
      label: 'Employees',
      content: <EmployeesTab employees={employees} currentUser={profile} onRefresh={loadEmployees} loading={loading} />
    },
    {
      id: 'projects',
      label: 'Projects',
      content: <ProjectsTab projects={projects} employees={employees} onRefresh={loadProjects} loading={loading} viewerRole={profile.role} />
    }
  ];

  return <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
};

export default SupervisorDashboard;
