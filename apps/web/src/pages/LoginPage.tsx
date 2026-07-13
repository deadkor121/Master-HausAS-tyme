import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { describeAxiosError } from '../lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const user = await loginUser(form.email, form.password);
      const target = user.role === 'worker'
        ? '/worker-attendance'
        : (location.state as { from?: string } | null)?.from || '/';
      navigate(target, { replace: true });
    } catch (err) {
      setError(describeAxiosError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">MasterHaus AS</p>
        <h1 className="mt-3 text-4xl font-semibold">Вход</h1>
        <p className="mt-3 text-sm text-slate-400">Админ видит управление заказами, работниками, дашборд и бухгалтерию. Работник видит только свой учёт времени.</p>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4">
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Email</label>
            <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Пароль</label>
            <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </div>

          {error ? <div className="rounded-xl border border-rose-700/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          <button className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70" disabled={isSubmitting}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Нет аккаунта? <Link to="/register" className="text-cyan-300">Регистрация</Link>
        </p>
      </div>
    </div>
  );
}
