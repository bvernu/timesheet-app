import UserManagement from './UserManagement';

const EmployeesTab = ({ employees, onRefresh, currentUser, loading }) => {
  return <UserManagement employees={employees} onRefresh={onRefresh} currentUser={currentUser} loading={loading} />;
};

export default EmployeesTab;
