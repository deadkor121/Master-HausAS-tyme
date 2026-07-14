import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import { oreToNokInputValue, parseNokInputToOre } from '../lib/currency';

type Worker = {
  id: string;
  fullName: string;
  role: string;
  hourlyRateOre: number;
  skillTags: string[];
  brigadeName: string | null;
  isActive: boolean;
};

type Props = {
  editingWorker: Worker | null;
  onSaved: () => void;
  onCancel: () => void;
};

const emptyForm = {
  fullName: '',
  role: '',
  hourlyRateNok: '230',
  skillTags: '',
  brigadeName: '',
  isActive: true
};

export default function WorkerForm({ editingWorker, onSaved, onCancel }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingWorker) {
      setForm(emptyForm);
      return;
    }

    setForm({
      fullName: editingWorker.fullName,
      role: editingWorker.role,
      hourlyRateNok: oreToNokInputValue(editingWorker.hourlyRateOre),
      skillTags: editingWorker.skillTags.join(', '),
      brigadeName: editingWorker.brigadeName ?? '',
      isActive: editingWorker.isActive
    });
  }, [editingWorker]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = await ensureAccessToken();
      const payload = {
        fullName: form.fullName,
        role: form.role,
        hourlyRateOre: parseNokInputToOre(form.hourlyRateNok),
        skillTags: form.skillTags.split(',').map((item) => item.trim()).filter(Boolean),
        brigadeName: form.brigadeName || undefined,
        isActive: form.isActive
      };

      if (editingWorker) {
        await axios.put(`${API_BASE}/api/v1/workers/${editingWorker.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/api/v1/workers`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setForm(emptyForm);
      await onSaved();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = typeof error.response?.data?.error === 'string' ? error.response?.data?.error : null;
        setSubmitError(apiError ?? `Request failed (${error.response?.status ?? 'network'})`);
      } else {
        setSubmitError('Failed to save worker');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{editingWorker ? 'Edit worker' : 'Add worker'}</h2>
        {editingWorker ? (
          <button type="button" className="rounded border border-slate-700 px-3 py-1.5 text-xs" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <div className="rounded border border-cyan-900/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100">
        Заполните карточку сотрудника: имя, роль, ставку в норвежских кронах и при необходимости список навыков через запятую.
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Полное имя</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: Ole Hansen" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Роль</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: carpenter, electrician" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required />
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Почасовая ставка в NOK</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="number" step="0.01" placeholder="Например: 230" value={form.hourlyRateNok} onChange={(event) => setForm({ ...form, hourlyRateNok: event.target.value })} required />
        <p className="text-xs text-slate-500">Введите сумму в норвежских кронах за час. Например: 230.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Навыки</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: painting, finishing, tiles" value={form.skillTags} onChange={(event) => setForm({ ...form, skillTags: event.target.value })} />
        <p className="text-xs text-slate-500">Несколько навыков указываются через запятую.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-slate-300">Бригада</label>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Например: Brigade A" value={form.brigadeName} onChange={(event) => setForm({ ...form, brigadeName: event.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-slate-300">
        <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
        Active worker
      </label>
      {submitError ? <p className="text-sm text-rose-300">{submitError}</p> : null}
      <button className="rounded bg-cyan-500 px-3 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : editingWorker ? 'Save worker' : 'Create worker'}
      </button>
    </form>
  );
}

