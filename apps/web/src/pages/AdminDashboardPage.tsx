import { useEffect, useState } from 'react';
import axios from 'axios';
import { ensureAccessToken } from '../lib/auth';
import AdminShell from '../components/AdminShell';

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
      const token = ensureAccessToken();
      const response = await axios.get(`${API_BASE}/api/v1/dashboard/live-overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.orders ?? []);
      setAlerts(response.data.alerts ?? []);
    };

    loadDashboard();
  }, []);

  return (
    <AdminShell eyebrow="Live overview" title="Админ-дашборд" description="Ключевой экран для контроля активных заказов, дедлайнов и сигналов по загрузке команды.">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold">Активные объекты</h2>
          <div className="mt-5 space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-cyan-300">{order.orderNumber}</p>
                    <p className="mt-1 text-lg font-semibold">{order.title}</p>
                  </div>
                  <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">{order.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-400">Deadline: {order.deadlineDate}</p>
                <p className="mt-2 text-sm text-slate-500">Workers: {order.assignedWorkers.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-6">
            <h2 className="text-2xl font-semibold">Alerts</h2>
            <div className="mt-4 space-y-3">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div key={alert.orderId} className="rounded-[1.5rem] border border-amber-400/20 bg-slate-950/30 p-4 text-sm text-amber-50">
                  <p className="font-medium">{alert.orderNumber}</p>
                  <p className="mt-2 text-amber-100/80">{alert.message}</p>
                </div>
              )) : <p className="text-sm text-amber-50/70">Сейчас критических алертов нет.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Визуальный фокус</p>
            <h3 className="mt-3 text-2xl font-semibold">Чистый штабной экран</h3>
            <p className="mt-3 text-sm text-slate-400">Дашборд переведён в более собранный стиль: крупные карточки, спокойный контраст и меньше ощущения “таблицы ради таблицы”.</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
