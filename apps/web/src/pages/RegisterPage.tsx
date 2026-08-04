import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { describeAxiosError, type AuthRole } from '../lib/auth';
import { uploadRegistrationPhoto } from '../lib/cloudinary';

export default function RegisterPage({ forcedRole, title = 'Регистрация', description = 'Создай аккаунт администратора или работника.' }: { forcedRole?: AuthRole; title?: string; description?: string }) {
  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: forcedRole ?? ('worker' as AuthRole),
    phone: '',
    photoUrl: '',
    skillTags: '',
    bio: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const isWorkerRegistration = forcedRole === 'worker' || form.role === 'worker';

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setError('');

    try {
      const photoUrl = await uploadRegistrationPhoto(file);
      setForm((previous) => ({ ...previous, photoUrl }));
    } catch (err) {
      setError(describeAxiosError(err));
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: forcedRole ?? form.role,
        ...(isWorkerRegistration
          ? {
              phone: form.phone.trim() || undefined,
              photoUrl: form.photoUrl.trim() || undefined,
              skillTags: form.skillTags.split(',').map((item) => item.trim()).filter(Boolean),
              bio: form.bio.trim() || undefined
            }
          : {})
      };

      const user = await registerUser(payload);
      navigate(user.role === 'worker' ? '/worker' : '/home', { replace: true });
    } catch (err) {
      setError(describeAxiosError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">MasterHaus AS</p>
        <h1 className="mt-3 text-4xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">{description}</p>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1 md:col-span-2">
            <label className="text-sm text-slate-300">Полное имя</label>
            <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Email</label>
            <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Пароль</label>
            <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={6} />
          </div>

          {isWorkerRegistration ? (
            <>
              <div className="grid gap-1 md:col-span-2">
                <label className="text-sm text-slate-300">Телефон</label>
                <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="+47 900 00 000" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="grid gap-1 md:col-span-2">
                <label className="text-sm text-slate-300">Фото работника</label>
                <div className="grid gap-3 sm:grid-cols-[120px_1fr] sm:items-start">
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                    {form.photoUrl ? <img src={form.photoUrl} alt="Worker photo preview" className="h-full w-full object-cover" /> : <span className="px-3 text-center text-xs text-slate-500">Фото появится здесь</span>}
                  </div>
                  <div className="grid gap-2">
                    <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="file" accept="image/*" onChange={handlePhotoUpload} />
                    <p className="text-xs text-slate-500">{isUploadingPhoto ? 'Фото загружается в Cloudinary...' : 'Можно загрузить только файл.'}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-1 md:col-span-2">
                <label className="text-sm text-slate-300">Навыки</label>
                <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="painting, finishing, tiles" value={form.skillTags} onChange={(event) => setForm({ ...form, skillTags: event.target.value })} />
              </div>
              <div className="grid gap-1 md:col-span-2">
                <label className="text-sm text-slate-300">Краткое описание</label>
                <textarea className="min-h-28 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Опыт, сильные стороны, специализация..." value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
              </div>
            </>
          ) : null}

          {forcedRole ? null : (
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm text-slate-300">Роль</label>
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AuthRole })}>
                <option value="worker">Работник</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          )}

          {error ? <div className="rounded-xl border border-rose-700/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 md:col-span-2">{error}</div> : null}

          <button className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70 md:col-span-2" disabled={isSubmitting || isUploadingPhoto}>
            {isSubmitting ? 'Создаём...' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-400">
          <p>Уже есть аккаунт? <Link to="/login" className="text-cyan-300">Войти</Link></p>
          {!forcedRole ? <p>Нужна отдельная регистрация работника? <Link to="/register/worker" className="text-emerald-300">Открыть worker-форму</Link></p> : null}
        </div>
      </div>
    </div>
  );
}
