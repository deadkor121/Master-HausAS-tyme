import { useEffect, useState } from 'react';
import axios from 'axios';
import { ensureAccessToken } from '../lib/auth';

type Order = {
  id: string;
  orderNumber: string;
  title: string;
};

type TimeEntry = {
  id: string;
  orderId: string;
  month: string;
  regularHours: number;
  overtimeHours: number;
};

type Props = {
  workerId: string | null;
  orders: Order[];
  editingEntry: TimeEntry | null;
  month: string;
  onSaved: () => void;
  onCancel: () => void;
};

export default function TimeEntryForm({ workerId, orders, editingEntry, month, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    orderId: '',
    month,
    regularHours: '160',
    overtimeHours: '0'
  });

  useEffect(() => {
    if (editingEntry) {
      setForm({
        orderId: editingEntry.orderId,
        month: editingEntry.month,
        regularHours: String(editingEntry.regularHours),
        overtimeHours: String(editingEntry.overtimeHours)
      });
      return;
    }

    setForm({
      orderId: orders[0]?.id ?? '',
      month,
      regularHours: '160',
      overtimeHours: '0'
    });
  }, [editingEntry, month, orders]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workerId) {
      return;
    }

    const token = await ensureAccessToken();
    const payload = {
      orderId: form.orderId,
      month: form.month,
      regularHours: Number(form.regularHours),
      overtimeHours: Number(form.overtimeHours)
    };

    if (editingEntry) {
      await axios.put(`${API_BASE}/api/v1/time-entries/${editingEntry.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } else {
      await axios.post(`${API_BASE}/api/v1/workers/${workerId}/time-entries`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    onSaved();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{editingEntry ? 'Edit hours' : 'Add hours'}</h2>
        {editingEntry ? (
          <button type="button" className="rounded border border-slate-700 px-3 py-1.5 text-xs" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <div className="rounded border border-cyan-900/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100">
        Здесь вы указываете, по какому заказу сотрудник работал и сколько обычных и сверхурочных часов он отработал за месяц.
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Заказ</label>
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} required>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.orderNumber} - {order.title}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Месяц учёта</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: 2026-07" pattern="\d{4}-\d{2}" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} required />
        <p className="text-xs text-slate-500">Формат: год-месяц.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Обычные часы</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="number" placeholder="Например: 160" value={form.regularHours} onChange={(event) => setForm({ ...form, regularHours: event.target.value })} required />
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Сверхурочные часы</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="number" placeholder="Например: 8" value={form.overtimeHours} onChange={(event) => setForm({ ...form, overtimeHours: event.target.value })} required />
      </div>
      <button className="rounded bg-cyan-500 px-3 py-2 font-medium text-slate-950" type="submit">
        {editingEntry ? 'Save hours' : 'Create hours'}
      </button>
    </form>
  );
}
