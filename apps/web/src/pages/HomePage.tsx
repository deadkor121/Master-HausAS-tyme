import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import AdminShell from '../components/AdminShell';

const cards = [
  { title: 'Заказы', text: 'Создавай объекты, держи дедлайны и статус работ под рукой.', to: '/orders' },
  { title: 'Работники', text: 'Следи за командами, ставками, часами и зарплатными срезами.', to: '/workers' },
  { title: 'Учёт времени', text: 'Быстро проваливайся в табели и рабочие смены сотрудников.', to: '/worker-attendance' },
  { title: 'Бухгалтерия', text: 'Доходы, расходы и чистая прибыль в одном экране.', to: '/accounting' }
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AdminShell
      eyebrow="Control center"
      title="Операционный центр"
      description="Красивый домашний экран для управления компанией: всё важное видно сразу, а до ключевых разделов — один клик."
      actions={<Link to="/dashboard" className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300">Открыть дашборд</Link>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 md:p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Добро пожаловать</p>
          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">Привет, {user?.fullName}</h2>
          <p className="mt-4 max-w-2xl text-base text-slate-400">
            Этот экран — твоя быстрая точка входа: отсюда можно перейти к заказам, финансам, табелям и составу команды без ощущения, что ты работаешь в скучной ERP из нулевых.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <Link key={card.to} to={card.to} className="group rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5 transition hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-slate-950/70">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">{card.title}</h3>
                  <span className="text-cyan-300 transition group-hover:translate-x-1">→</span>
                </div>
                <p className="mt-3 text-sm text-slate-400">{card.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6">
          <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Фокус дня</p>
            <h3 className="mt-3 text-2xl font-semibold">Управляй без перегруза</h3>
            <p className="mt-3 text-sm text-cyan-50/80">Новая главная страница специально собрана как мягкий штаб: крупная типографика, понятные CTA, быстрые переходы и минимум визуального мусора.</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Быстрые действия</p>
            <div className="mt-4 grid gap-3">
              <Link to="/orders" className="rounded-2xl bg-white/5 px-4 py-4 text-sm hover:bg-white/10">Создать или проверить заказ</Link>
              <Link to="/workers" className="rounded-2xl bg-white/5 px-4 py-4 text-sm hover:bg-white/10">Открыть карточки работников</Link>
              <Link to="/accounting" className="rounded-2xl bg-white/5 px-4 py-4 text-sm hover:bg-white/10">Проверить бухгалтерию</Link>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
