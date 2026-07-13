import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

function NavItem({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`rounded-2xl px-4 py-3 text-sm transition ${active ? 'bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/20' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
    >
      {label}
    </Link>
  );
}

export default function WorkerShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_26%),linear-gradient(180deg,#020617_0%,#111827_50%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-slate-950/70 p-4 backdrop-blur lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-r lg:p-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Worker Space</p>
            <h2 className="mt-3 text-3xl font-semibold">Личный кабинет</h2>
            <p className="mt-3 text-sm text-slate-400">Чистый интерфейс для собственных смен, статистики и настроек профиля.</p>
          </div>

          <div className="mt-6 space-y-2">
            <NavItem to="/worker" label="Обзор" />
            <NavItem to="/worker-attendance" label="Мои смены" />
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Аккаунт</p>
            <p className="mt-3 text-lg font-semibold">{user?.fullName}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <button onClick={logout} className="mt-4 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 transition hover:bg-emerald-500/20">Выйти</button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">MasterHaus AS</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
            {description ? <p className="mt-3 max-w-3xl text-base text-slate-400 md:text-lg">{description}</p> : null}
          </header>
          <section className="mt-6">{children}</section>
        </main>
      </div>
    </div>
  );
}
