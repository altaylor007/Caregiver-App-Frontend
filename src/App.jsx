import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminCaregiversPage from './pages/AdminCaregiversPage';
import AdminResponsibilitiesPage from './pages/AdminResponsibilitiesPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminPayrollPage from './pages/AdminPayrollPage';
import CaregiverResponsibilitiesPage from './pages/CaregiverResponsibilitiesPage';
import AvailabilityPage from './pages/AvailabilityPage';
import SchedulePage from './pages/SchedulePage';
import CaregiverDirectoryPage from './pages/CaregiverDirectoryPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';

import { useAuth } from './contexts/AuthContext';
import AdminRoute from './components/AdminRoute';

const ProtectedRoute = ({ children }) => {
  const { session, isLoading } = useAuth();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Loading...</p></div>;
  if (!session) return <Navigate to="/auth" replace />;
  return children;
};

function App() {
  const { session, isAdmin } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/" replace /> : <AuthPage />} />

        {/* Protected Routes enclosed in MainLayout */}
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={isAdmin ? <AdminDashboardPage /> : <DashboardPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="responsibilities" element={<CaregiverResponsibilitiesPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="directory" element={<CaregiverDirectoryPage />} />

          {/* Admin specific sub-pages */}
          <Route path="admin/caregivers" element={<AdminRoute><AdminCaregiversPage /></AdminRoute>} />
          <Route path="admin/responsibilities" element={<AdminRoute><AdminResponsibilitiesPage /></AdminRoute>} />
          <Route path="admin/schedule" element={<AdminRoute><AdminSchedulePage /></AdminRoute>} />
          <Route path="admin/reports" element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
          <Route path="admin/payroll" element={<AdminRoute><AdminPayrollPage /></AdminRoute>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
