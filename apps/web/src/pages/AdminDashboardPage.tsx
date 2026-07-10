import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ensureDemoAccessToken } from '../lib/auth';

type DashboardOrder = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  deadlineDate: string;
  assignedWorkers: string[];
};

type AlertItem = {
  orderId: string;
  orderNumber: string;
  message: string;
};

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      const token = await ensureDemoAccessToken();
      const response = await axios.get(`${API_BASE}/api/v1/dashboard/live-overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.orders ?? []);
      setAlerts(response.data.alerts ?? []);
    };

    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Monitor active orders, overdue risk and workforce allocation from one place.
            </p>
          </div>
          <Link to="/" className="rounded border border-slate-700 px-3 py-2 text-sm">Back home</Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Live overview</h2>
            <div className="mt-4 space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-cyan-300">{order.orderNumber}</p>
                      <p className="text-sm text-slate-400">{order.title}</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Deadline: {order.deadlineDate}</p>
                  <p className="mt-2 text-sm text-slate-400">Workers: {order.assignedWorkers.join(', ')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Alerts</h2>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <div key={alert.orderId} className="rounded-xl border border-amber-700/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-medium">{alert.orderNumber}</p>
                  <p className="mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
