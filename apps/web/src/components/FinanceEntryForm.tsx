import { useEffect, useState } from 'react';
import axios from 'axios';
import { ensureAccessToken } from '../lib/auth';
import { oreToNokInputValue, parseNokInputToOre } from '../lib/currency';

type EntryKind = 'payments' | 'expenses';

type OrderOption = {
  id: string;
  orderNumber: string;
  title: string;
};

type Entry = {
  id: string;
  orderId?: string;
  category?: string;
  amountOre: number;
  month: string;
};

type Props = {
  kind: EntryKind;
  orders?: OrderOption[];
  editingEntry: Entry | null;
  onSaved: () => void;
  onCancel: () => void;
};

const emptyForm = {
  orderId: 'order-1',
  category: 'material',
  amountNok: '10000',
  month: '2026-07'
};

export default function FinanceEntryForm({ kind, orders = [], editingEntry, onSaved, onCancel }: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const newForm = editingEntry
      ? {
          orderId: editingEntry.orderId ?? 'order-1',
          category: editingEntry.category ?? 'material',
          amountNok: oreToNokInputValue(editingEntry.amountOre),
          month: editingEntry.month
        }
      : { ...emptyForm, orderId: orders[0]?.id ?? emptyForm.orderId };

    setForm((prev) => {
      try {
        if (JSON.stringify(prev) === JSON.stringify(newForm)) return prev;
      } catch {
        // fallback: always set if stringify fails
      }
      return newForm;
    });
    // only re-run when editingEntry identity or orders length (not whole array) changes
  }, [editingEntry?.id, orders.length]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = await ensureAccessToken();
    const payload = kind === 'payments'
      ? { orderId: form.orderId, amountOre: parseNokInputToOre(form.amountNok), month: form.month }
      : { category: form.category, amountOre: parseNokInputToOre(form.amountNok), month: form.month };

    if (editingEntry) {
      await axios.put(`${API_BASE}/api/v1/${kind}/${editingEntry.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } else {
      await axios.post(`${API_BASE}/api/v1/${kind}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    setForm(emptyForm);
    onSaved();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">{editingEntry ? `Edit ${kind.slice(0, -1)}` : `Add ${kind.slice(0, -1)}`}</h2>
        {editingEntry ? (
          <button type="button" className="rounded border border-slate-700 px-3 py-1.5 text-xs" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <div className="rounded border border-cyan-900/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100">
        {kind === 'payments'
          ? 'Платёж привязывается к заказу и влияет на доход за выбранный месяц.'
          : 'Расход влияет на финансовый отчёт за выбранный месяц. Укажите категорию и сумму.'}
      </div>
      {kind === 'payments' ? (
        <div className="grid gap-1">
          <label className="text-slate-300">Заказ</label>
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} required>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>{order.orderNumber} - {order.title}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid gap-1">
          <label className="text-slate-300">Категория расхода</label>
          <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: material, transport" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        </div>
      )}
      <div className="grid gap-1">
        <label className="text-slate-300">Сумма в NOK</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="number" step="0.01" placeholder="Например: 10000" value={form.amountNok} onChange={(event) => setForm({ ...form, amountNok: event.target.value })} required />
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Месяц</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: 2026-07" pattern="\d{4}-\d{2}" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} required />
        <p className="text-xs text-slate-500">Формат: год-месяц.</p>
      </div>
      <button className="rounded bg-cyan-500 px-3 py-2 font-medium text-slate-950" type="submit">
        {editingEntry ? 'Save entry' : 'Create entry'}
      </button>
    </form>
  );
}
