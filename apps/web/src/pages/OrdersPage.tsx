import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import OrderForm from '../components/OrderForm';
import { ensureAccessToken } from '../lib/auth';
import AdminShell from '../components/AdminShell';

const ORDER_STATUSES = ['draft', 'planned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;

type Order = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState('');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});

  const loadOrders = async (search = query) => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      params: search.trim() ? { q: search.trim() } : undefined
    });
    const items = response.data.items ?? [];
    setOrders(items);
    setStatusDrafts(Object.fromEntries(items.map((order: Order) => [order.id, order.status])));
  };

  useEffect(() => {
    loadOrders('');
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return orders;
    }

    return orders.filter((order) =>
      [order.orderNumber, order.title, order.status].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [orders, query]);

  const updateOrderStatus = async (order: Order) => {
    const nextStatus = statusDrafts[order.id] ?? order.status;
    if (nextStatus === order.status) {
      return;
    }

    setSavingOrderId(order.id);
    try {
      const token = ensureAccessToken();
      await axios.put(
        `${API_BASE}/api/v1/orders/${order.id}`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadOrders(query);
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <AdminShell eyebrow="Orders" title="Управление заказами" description="Поиск по заказам, быстрое создание и смена статуса без лишних переходов.">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <OrderForm onCreated={() => loadOrders(query)} />
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4 md:p-5">
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none placeholder:text-slate-500"
              placeholder="Поиск по номеру, названию или статусу"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">Title</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const currentDraft = statusDrafts[order.id] ?? order.status;
                const changed = currentDraft !== order.status;
                const isSaving = savingOrderId === order.id;

                return (
                  <tr key={order.id} className="border-t border-white/10 align-top">
                    <td className="px-5 py-4 font-medium text-cyan-300">{order.orderNumber}</td>
                    <td className="px-5 py-4">{order.title}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                          value={currentDraft}
                          onChange={(event) => setStatusDrafts((previous) => ({ ...previous, [order.id]: event.target.value }))}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!changed || isSaving}
                          onClick={() => updateOrderStatus(order)}
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrders.length === 0 ? <p className="p-5 text-sm text-slate-400">Заказы не найдены.</p> : null}
        </div>
      </div>
    </AdminShell>
  );
}
