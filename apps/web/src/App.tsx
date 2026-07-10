import { Link, Route, Routes } from 'react-router-dom';
import OrdersPage from './pages/OrdersPage';
import WorkersPage from './pages/WorkersPage';
import AccountingPage from './pages/AccountingPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import WorkerAttendancePage from './pages/WorkerAttendancePage';

const Home = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-slate-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">MasterHaus AS</p>
          <h1 className="text-2xl font-semibold">Construction & Renovation Platform</h1>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link to="/orders" className="rounded border border-slate-700 px-3 py-2">Orders</Link>
          <Link to="/workers" className="rounded border border-slate-700 px-3 py-2">Workers</Link>
          <Link to="/worker-attendance" className="rounded border border-slate-700 px-3 py-2">Attendance</Link>
          <Link to="/dashboard" className="rounded border border-slate-700 px-3 py-2">Admin</Link>
          <Link to="/accounting" className="rounded border border-slate-700 px-3 py-2">Accounting</Link>
        </nav>
      </div>
    </header>

    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold">Orders</h2>
        <p className="mt-2 text-sm text-slate-400">Track projects, deadlines, assignments and countdowns.</p>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold">Workers & Salary</h2>
        <p className="mt-2 text-sm text-slate-400">Manage crews, time logs and payroll snapshots.</p>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold">Accounting</h2>
        <p className="mt-2 text-sm text-slate-400">Monitor revenue, expenses and export-ready reports.</p>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold">Attendance</h2>
        <p className="mt-2 text-sm text-slate-400">Separate worker page for daily check-in, check-out and calendar view.</p>
      </section>
    </main>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/workers" element={<WorkersPage />} />
      <Route path="/worker-attendance" element={<WorkerAttendancePage />} />
      <Route path="/dashboard" element={<AdminDashboardPage />} />
      <Route path="/accounting" element={<AccountingPage />} />
    </Routes>
  );
}
