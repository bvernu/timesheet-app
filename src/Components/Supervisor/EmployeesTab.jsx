import UserManagement from './UserManagement';

const EmployeesTab = ({ employees, onRefresh, currentUser }) => {
  return <UserManagement employees={employees} onRefresh={onRefresh} currentUser={currentUser} />;
};

export default EmployeesTab;