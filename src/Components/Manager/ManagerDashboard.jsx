import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Tabs from '../Common/Tabs';
import EmployeeDashboard from '../Employee/EmployeeDashboard';
import ProjectsTab from '../Supervisor/ProjectsTab';

const ManagerDashboard = ({ profile }) => {
  const [activeTab, setActiveTab] = useState('my-timesheet');
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadProjects(), loadEmployees()]).finally(() => setLoading(false));
  }, []);

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('serial_number', { ascending: false });
    
    if (data) {
      setProjects(data);
    }
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    
    if (data) {
      setEmployees(data);
    }
  };

  const tabs = [
    {
      id: 'my-timesheet',
      label: 'My timesheet',
      content: <EmployeeDashboard profile={profile} />
    },
    {
      id: 'projects',
      label: 'Projects',
      content: <ProjectsTab projects={projects} employees={employees} onRefresh={loadProjects} loading={loading} />
    }
  ];

  return <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
};

export default ManagerDashboard;
