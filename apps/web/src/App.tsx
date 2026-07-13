import { Navigate, Route, Routes } from 'react-router-dom';
import OrdersPage from './pages/OrdersPage';
import WorkersPage from './pages/WorkersPage';
import AccountingPage from './pages/AccountingPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import WorkerAttendancePage from './pages/WorkerAttendancePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './lib/AuthContext';
import HomePage from './pages/HomePage';
import WorkerCabinetPage from './pages/WorkerCabinetPage';

function RootRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'worker' ? '/worker' : '/home'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute roles={['admin']}><HomePage /></ProtectedRoute>} />
      <Route path="/worker" element={<ProtectedRoute roles={['worker']}><WorkerCabinetPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute roles={['admin']}><OrdersPage /></ProtectedRoute>} />
      <Route path="/workers" element={<ProtectedRoute roles={['admin']}><WorkersPage /></ProtectedRoute>} />
      <Route path="/worker-attendance" element={<ProtectedRoute roles={['admin', 'worker']}><WorkerAttendancePage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute roles={['admin']}><AccountingPage /></ProtectedRoute>} />
    </Routes>
  );
}
