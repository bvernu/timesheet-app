import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Tabs from '../Common/Tabs';
import EmployeeDashboard from '../Employee/EmployeeDashboard';
import ProjectsTab from '../Supervisor/ProjectsTab';

const ManagerDashboard = ({ profile }) => {
  const [activeTab, setActiveTab] = useState('my-timesheet');
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    loadProjects();
    loadEmployees();
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
      label: 'My Timesheet',
      content: <EmployeeDashboard profile={profile} />
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
          <h2>Manager Dashboard</h2>
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

export default ManagerDashboard;