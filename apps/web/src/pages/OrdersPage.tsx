import { useEffect, useState } from 'react';
import axios from 'axios';
import OrderForm from '../components/OrderForm';
import { ensureAccessToken } from '../lib/auth';
import AdminShell from '../components/AdminShell';

type Order = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = async () => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setOrders(response.data.items ?? []);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <AdminShell eyebrow="Orders" title="Управление заказами" description="Создание и просмотр объектов в более чистом интерфейсе с акцентом на быстрые действия.">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <OrderForm onCreated={loadOrders} />
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">Title</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-white/10">
                  <td className="px-5 py-4 font-medium text-cyan-300">{order.orderNumber}</td>
                  <td className="px-5 py-4">{order.title}</td>
                  <td className="px-5 py-4 capitalize text-slate-400">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
