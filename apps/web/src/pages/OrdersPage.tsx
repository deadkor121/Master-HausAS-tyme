import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import OrderForm from '../components/OrderForm';
import { ensureDemoAccessToken } from '../lib/auth';

type Order = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = async () => {
    const token = await ensureDemoAccessToken();
    const response = await axios.get('/api/v1/orders', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setOrders(response.data.items ?? []);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Orders</p>
            <h1 className="text-3xl font-semibold">Project management</h1>
          </div>
          <Link to="/" className="rounded border border-slate-700 px-3 py-2 text-sm">Back home</Link>
        </div>

        <div className="mb-6">
          <OrderForm onCreated={loadOrders} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-medium text-cyan-300">{order.orderNumber}</td>
                  <td className="px-4 py-3">{order.title}</td>
                  <td className="px-4 py-3 capitalize">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
