import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminCaregiversPage from './pages/AdminCaregiversPage';
import AdminDocumentsPage from './pages/AdminDocumentsPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminPayrollPage from './pages/AdminPayrollPage';
import CaregiverDocumentsPage from './pages/CaregiverDocumentsPage';
import AvailabilityPage from './pages/AvailabilityPage';
import SchedulePage from './pages/SchedulePage';
import CaregiverDirectoryPage from './pages/CaregiverDirectoryPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';
import AdminRolesPage from './pages/AdminRolesPage';
import AuthPage from './pages/AuthPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import LandingPage from './pages/LandingPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';


import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AdminRoute from './components/AdminRoute';

const ProtectedRoute = ({ children, requirePasswordCheck = true }) => {
  const { session, profile } = useAuth();
  if (!session) return <Navigate to="/welcome" replace />;
  if (requirePasswordCheck && profile?.requires_password_change) {
    return <Navigate to="/update-password" replace />;
  }
  return children;
};

function App() {
  const { session, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemeProvider>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--neutral-800)' }}>
          <p>Loading application...</p>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/welcome" element={session ? <Navigate to="/" replace /> : <LandingPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/auth" element={session ? <Navigate to="/" replace /> : <AuthPage />} />
          <Route path="/update-password" element={<ProtectedRoute requirePasswordCheck={false}><UpdatePasswordPage /></ProtectedRoute>} />

          {/* Protected Routes enclosed in MainLayout */}
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={isAdmin ? <AdminDashboardPage /> : <DashboardPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="documents" element={<CaregiverDocumentsPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="directory" element={<CaregiverDirectoryPage />} />

            {/* Admin specific sub-pages */}
            <Route path="admin/caregivers" element={<AdminRoute><AdminCaregiversPage /></AdminRoute>} />
            <Route path="admin/documents" element={<AdminRoute><AdminDocumentsPage /></AdminRoute>} />
            <Route path="admin/schedule" element={<AdminRoute><AdminSchedulePage /></AdminRoute>} />
            <Route path="admin/reports" element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
            <Route path="admin/payroll" element={<AdminRoute><AdminPayrollPage /></AdminRoute>} />
            <Route path="admin/roles" element={<AdminRoute><AdminRolesPage /></AdminRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
