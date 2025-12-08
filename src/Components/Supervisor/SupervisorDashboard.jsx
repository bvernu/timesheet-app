import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Tabs from '../Common/Tabs';
import TimesheetsTab from './TimesheetsTab';
import EmployeesTab from './EmployeesTab';
import ProjectsTab from './ProjectsTab';

const SupervisorDashboard = ({ profile }) => {
  const [activeTab, setActiveTab] = useState('timesheets');
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);

  useEffect(() => {
    loadEmployees();
    loadProjects();
    loadAllTimeEntries();
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
      .order('name');
    
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
      id: 'timesheets',
      label: 'All Timesheets',
      content: <TimesheetsTab timeEntries={timeEntries} employees={employees} />
    },
    {
      id: 'employees',
      label: 'Employees',
      content: <EmployeesTab employees={employees} currentUser={profile} onRefresh={loadEmployees} />
    },
    {
      id: 'projects',
      label: 'Projects',
      content: <ProjectsTab projects={projects} employees={employees} onRefresh={loadProjects} />
    }
  ];

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col">
          <h2>Supervisor Dashboard</h2>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;