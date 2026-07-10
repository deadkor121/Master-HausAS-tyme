import { useState } from 'react';
import axios from 'axios';
import { ensureDemoAccessToken } from '../lib/auth';
import { parseNokInputToOre } from '../lib/currency';

type Props = {
  onCreated: () => Promise<void> | void;
};

export default function OrderForm({ onCreated }: Props) {
  const [form, setForm] = useState({
    orderNumber: '',
    title: '',
    status: 'planned',
    budgetTotalNok: '40000',
    deadlineDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const token = await ensureDemoAccessToken();
      await axios.post(`${API_BASE}/api/v1/orders`, {
        ...form,
        budgetTotalOre: parseNokInputToOre(form.budgetTotalNok)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await onCreated();
      setForm({ orderNumber: '', title: '', status: 'planned', budgetTotalNok: '40000', deadlineDate: '' });
      setSuccessMessage('Заказ успешно создан и добавлен в список.');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage = typeof error.response?.data?.error === 'string' ? error.response.data.error : '';
        setErrorMessage(apiMessage || 'Не удалось создать заказ. Проверьте поля и попробуйте снова.');
      } else {
        setErrorMessage('Не удалось создать заказ. Проверьте подключение к серверу и попробуйте снова.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
      {successMessage ? (
        <div className="rounded border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded border border-rose-700/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}
      <div className="grid gap-1">
        <label className="text-slate-300">Номер заказа</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: MH-2026-0101" value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} required />
        <p className="text-xs text-slate-500">Уникальный номер заказа для поиска и учёта.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Название проекта</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: Ремонт кухни" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Срок выполнения</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="date" value={form.deadlineDate} onChange={(event) => setForm({ ...form, deadlineDate: event.target.value })} required />
        <p className="text-xs text-slate-500">Дата, к которой заказ должен быть завершён.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Бюджет в NOK</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="number" step="0.01" placeholder="Например: 40000" value={form.budgetTotalNok} onChange={(event) => setForm({ ...form, budgetTotalNok: event.target.value })} required />
        <p className="text-xs text-slate-500">Введите сумму в норвежских кронах. Например: 40000 = 40 000 NOK.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Статус заказа</label>
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
        <option value="planned">Planned</option>
        <option value="in_progress">In progress</option>
        <option value="on_hold">On hold</option>
        <option value="completed">Completed</option>
        </select>
      </div>
      <button className="rounded bg-cyan-500 px-3 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Создание заказа...' : 'Создать заказ'}
      </button>
    </form>
  );
}
