import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import { oreToNokInputValue, parseNokInputToOre } from '../lib/currency';
import { uploadWorkerPhoto } from '../lib/cloudinary';

type Worker = {
  id: string;
  fullName: string;
  role: string;
  hourlyRateOre: number;
  skillTags: string[];
  brigadeName: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
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
  phone: '',
  email: '',
  photoUrl: '',
  bio: '',
  isActive: true
};

export default function WorkerForm({ editingWorker, onSaved, onCancel }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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
      phone: editingWorker.phone ?? '',
      email: editingWorker.email ?? '',
      photoUrl: editingWorker.photoUrl ?? '',
      bio: editingWorker.bio ?? '',
      isActive: editingWorker.isActive
    });
  }, [editingWorker]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setSubmitError(null);
    try {
      const photoUrl = await uploadWorkerPhoto(file);
      setForm((previous) => ({ ...previous, photoUrl }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = typeof error.response?.data?.error === 'string' ? error.response?.data?.error : null;
        setSubmitError(apiError ?? 'Не удалось загрузить фото в Cloudinary');
      } else {
        setSubmitError('Не удалось загрузить фото в Cloudinary');
      }
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  };

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
        phone: form.phone || undefined,
        email: form.email || undefined,
        photoUrl: form.photoUrl || undefined,
        bio: form.bio || undefined,
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
    <form onSubmit={submit} className="grid gap-5 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{editingWorker ? 'Редактировать работника' : 'Добавить работника'}</h2>
          <p className="text-xs text-slate-400">Профессиональная карточка сотрудника с контактами, ставкой, навыками и фото.</p>
        </div>
        {editingWorker ? (
          <button type="button" className="rounded-2xl border border-white/10 px-3 py-1.5 text-xs" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className="grid gap-5">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <div className="aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-slate-900">
            {form.photoUrl ? (
              <img src={form.photoUrl} alt={form.fullName || 'Worker photo'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">Фото работника появится здесь</div>
            )}
          </div>
          <label className="mt-3 block cursor-pointer rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center font-medium text-cyan-100">
            {isUploadingPhoto ? 'Загрузка фото...' : 'Загрузить фото'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
          <p className="mt-2 text-xs text-slate-500">Фото уходит в Cloudinary, поэтому не пропадёт после нового deploy/render build.</p>
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="grid gap-1">
            <label className="text-slate-300">Полное имя</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" placeholder="Например: Ole Hansen" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Роль</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" placeholder="Например: carpenter" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Бригада</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" placeholder="Например: Brigade A" value={form.brigadeName} onChange={(event) => setForm({ ...form, brigadeName: event.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Почасовая ставка в NOK</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" type="number" step="0.01" placeholder="Например: 230" value={form.hourlyRateNok} onChange={(event) => setForm({ ...form, hourlyRateNok: event.target.value })} required />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Телефон</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" placeholder="Например: +47 900 00 000" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Email</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" type="email" placeholder="worker@masterhaus.no" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Навыки</label>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" placeholder="Например: painting, finishing, tiles" value={form.skillTags} onChange={(event) => setForm({ ...form, skillTags: event.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-slate-300">Краткое описание</label>
            <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-3" placeholder="Опыт, сильные стороны, специализация..." value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            Active worker
          </label>
        </div>
      </div>

      {submitError ? <p className="text-sm text-rose-300">{submitError}</p> : null}
      <button className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={isSubmitting || isUploadingPhoto}>
        {isSubmitting ? 'Saving...' : editingWorker ? 'Save worker' : 'Create worker'}
      </button>
    </form>
  );
}
