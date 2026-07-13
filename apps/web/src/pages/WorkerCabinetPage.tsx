import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import WorkerShell from '../components/WorkerShell';

function initials(name?: string) {
  if (!name) return 'W';
  return name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export default function WorkerCabinetPage() {
  const { user } = useAuth();
  const joined = useMemo(() => new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }), []);

  return (
    <WorkerShell title="Кабинет работника" description="Аккуратная стартовая страница с твоим профилем, быстрыми действиями и простыми настройками интерфейса.">
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-300 text-2xl font-semibold text-slate-950">
              {initials(user?.fullName)}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Профиль</p>
              <h2 className="mt-2 text-3xl font-semibold">{user?.fullName}</h2>
              <p className="mt-2 text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Статус</p>
              <p className="mt-3 text-2xl font-semibold text-emerald-300">Активный</p>
              <p className="mt-2 text-sm text-slate-400">Доступ к учёту личных смен и календарю.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Сегодня</p>
              <p className="mt-3 text-2xl font-semibold">{joined}</p>
              <p className="mt-2 text-sm text-slate-400">Быстрый вход в рабочий день без лишних экранов.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link to="/worker-attendance" className="rounded-[1.5rem] border border-emerald-400/30 bg-emerald-400/10 p-5 transition hover:-translate-y-1 hover:bg-emerald-400/15">
              <h3 className="text-xl font-semibold">Мои смены</h3>
              <p className="mt-3 text-sm text-slate-300">Открыть личную страницу, поставить дату и время работы, посмотреть календарь и заработок.</p>
            </Link>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <h3 className="text-xl font-semibold">Мои настройки</h3>
              <p className="mt-3 text-sm text-slate-400">Сейчас доступны настройки профиля в интерфейсе. Следующим шагом можно добавить смену пароля и личные уведомления.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Настройки профиля</p>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl bg-slate-950/40 p-4">
                <p className="text-sm text-slate-400">Имя</p>
                <p className="mt-2 text-lg font-semibold">{user?.fullName}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/40 p-4">
                <p className="text-sm text-slate-400">Email</p>
                <p className="mt-2 text-lg font-semibold">{user?.email}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/40 p-4">
                <p className="text-sm text-slate-400">Роль</p>
                <p className="mt-2 text-lg font-semibold">Работник</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-100/80">Чистый интерфейс</p>
            <h3 className="mt-3 text-2xl font-semibold">Без перегруза</h3>
            <p className="mt-3 text-sm text-emerald-50/80">В кабинете работника оставлены только нужные вещи: профиль, переход в мои смены и базовые настройки. Никаких админских разделов и лишней бухгалтерии.</p>
          </div>
        </section>
      </div>
    </WorkerShell>
  );
}
