import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { describeAxiosError, type AuthRole } from '../lib/auth';

export default function RegisterPage({ forcedRole, title = 'Регистрация', description = 'Создай аккаунт администратора или работника. Для работника будет доступна только страница учёта рабочего времени.' }: { forcedRole?: AuthRole; title?: string; description?: string }) {
  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: forcedRole ?? 'worker' as AuthRole });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const user = await registerUser({ ...form, role: forcedRole ?? form.role });
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

          {forcedRole ? (
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 md:col-span-2">
              Аккаунт будет создан как <strong>работник</strong> и получит доступ к личной странице постановки смен.
            </div>
          ) : (
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm text-slate-300">Роль</label>
              <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AuthRole })}>
                <option value="worker">Работник</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          )}

          {error ? <div className="rounded-xl border border-rose-700/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 md:col-span-2">{error}</div> : null}

          <button className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70 md:col-span-2" disabled={isSubmitting}>
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
