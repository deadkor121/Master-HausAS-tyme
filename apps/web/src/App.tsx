import { Link, Navigate, Route, Routes } from 'react-router-dom';
import OrdersPage from './pages/OrdersPage';
import WorkersPage from './pages/WorkersPage';
import AccountingPage from './pages/AccountingPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import WorkerAttendancePage from './pages/WorkerAttendancePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './lib/AuthContext';

const Home = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'worker') {
    return <Navigate to="/worker-attendance" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">MasterHaus AS</p>
            <h1 className="text-2xl font-semibold">Admin workspace</h1>
            <p className="mt-2 text-sm text-slate-400">Вошли как {user.fullName} · {user.email}</p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
            <Link to="/orders" className="rounded border border-slate-700 px-3 py-2">Orders</Link>
            <Link to="/workers" className="rounded border border-slate-700 px-3 py-2">Workers</Link>
            <Link to="/worker-attendance" className="rounded border border-slate-700 px-3 py-2">Attendance</Link>
            <Link to="/dashboard" className="rounded border border-slate-700 px-3 py-2">Admin</Link>
            <Link to="/accounting" className="rounded border border-slate-700 px-3 py-2">Accounting</Link>
            <button onClick={logout} className="rounded border border-rose-800 px-3 py-2 text-rose-200">Logout</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Заказы</h2>
          <p className="mt-2 text-sm text-slate-400">Создание, просмотр и контроль дедлайнов.</p>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Работники</h2>
          <p className="mt-2 text-sm text-slate-400">Управление сотрудниками, ставками и табелями.</p>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Бухгалтерия</h2>
          <p className="mt-2 text-sm text-slate-400">Финансовые отчёты, платежи и расходы только для админов.</p>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Учёт времени</h2>
          <p className="mt-2 text-sm text-slate-400">Отдельная страница для отметки рабочих смен.</p>
        </section>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute roles={['admin']}><OrdersPage /></ProtectedRoute>} />
      <Route path="/workers" element={<ProtectedRoute roles={['admin']}><WorkersPage /></ProtectedRoute>} />
      <Route path="/worker-attendance" element={<ProtectedRoute roles={['admin', 'worker']}><WorkerAttendancePage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute roles={['admin']}><AccountingPage /></ProtectedRoute>} />
    </Routes>
  );
}
