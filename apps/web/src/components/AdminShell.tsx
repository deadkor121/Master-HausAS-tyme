import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block rounded-2xl px-4 py-3 text-sm transition ${active ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
    >
      {label}
    </Link>
  );
}

export default function AdminShell({ title, eyebrow, description, actions, children }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">MasterHaus AS</p>
        <h2 className="mt-3 text-3xl font-semibold">Admin Core</h2>
        <p className="mt-3 text-sm text-slate-400">Управление заказами, людьми, финансами и рабочим временем в одном месте.</p>
      </div>

      <div className="mt-6 space-y-2">
        <NavItem to="/home" label="Главная" onClick={() => setMobileOpen(false)} />
        <NavItem to="/dashboard" label="Дашборд" onClick={() => setMobileOpen(false)} />
        <NavItem to="/orders" label="Заказы" onClick={() => setMobileOpen(false)} />
        <NavItem to="/workers" label="Работники" onClick={() => setMobileOpen(false)} />
        <NavItem to="/worker-attendance" label="Учёт времени" onClick={() => setMobileOpen(false)} />
        <NavItem to="/accounting" label="Бухгалтерия" onClick={() => setMobileOpen(false)} />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Профиль</p>
        <p className="mt-3 text-lg font-semibold">{user?.fullName}</p>
        <p className="text-sm text-slate-400">{user?.email}</p>
        <button onClick={logout} className="mt-4 w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-500/20">Выйти</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur lg:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">MasterHaus AS</p>
            <p className="mt-1 text-lg font-semibold">Admin Core</p>
          </div>
          <button onClick={() => setMobileOpen((value) => !value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {mobileOpen ? 'Закрыть' : 'Меню'}
          </button>
        </div>

        {mobileOpen ? <div className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

        <aside className={`fixed inset-y-0 left-0 z-40 w-[85vw] max-w-80 overflow-y-auto border-r border-white/10 bg-slate-950/95 p-4 backdrop-blur transition-transform lg:static lg:min-h-screen lg:w-80 lg:translate-x-0 lg:border-b-0 lg:bg-slate-950/70 lg:p-6 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:block`}>
          {sidebar}
        </aside>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            {eyebrow ? <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</p> : null}
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
                {description ? <p className="mt-3 max-w-3xl text-base text-slate-400 md:text-lg">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>
          </header>

          <section className="mt-6">{children}</section>
        </main>
      </div>
    </div>
  );
}
