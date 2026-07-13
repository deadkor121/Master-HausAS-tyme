import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import WorkerShell from '../components/WorkerShell';
import { describeAxiosError } from '../lib/auth';

function initials(name?: string) {
  if (!name) return 'W';
  return name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export default function WorkerCabinetPage() {
  const { user, updateSettings, changeUserPassword } = useAuth();
  const joined = useMemo(() => new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }), []);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(Boolean(user?.emailNotificationsEnabled));
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [settingsState, setSettingsState] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordState, setPasswordState] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsState(null);
    try {
      await updateSettings({ emailNotificationsEnabled });
      setSettingsState({ type: 'success', text: emailNotificationsEnabled ? 'Email-уведомления для работника включены.' : 'Email-уведомления отключены.' });
    } catch (error) {
      setSettingsState({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setSavingSettings(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordState(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordState({ type: 'error', text: 'Новый пароль должен быть не короче 6 символов.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({ type: 'error', text: 'Подтверждение пароля не совпадает.' });
      return;
    }

    setSavingPassword(true);
    try {
      await changeUserPassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordState({ type: 'success', text: 'Пароль успешно изменён.' });
    } catch (error) {
      setPasswordState({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <WorkerShell title="Кабинет работника" description="Аккуратная стартовая страница с твоим профилем, быстрыми действиями и уже рабочими настройками: пароль и email-уведомления.">
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

          <div className="mt-8">
            <Link to="/worker-attendance" className="block rounded-[1.5rem] border border-emerald-400/30 bg-emerald-400/10 p-5 transition hover:-translate-y-1 hover:bg-emerald-400/15">
              <h3 className="text-xl font-semibold">Мои смены</h3>
              <p className="mt-3 text-sm text-slate-300">Открыть личную страницу, поставить дату и время работы, посмотреть календарь и заработок.</p>
            </Link>
          </div>
        </section>

        <section className="grid gap-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Настройки работника</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-950/40 p-4">
                <p className="text-sm text-slate-400">Email для уведомлений</p>
                <p className="mt-2 text-lg font-semibold">{user?.email}</p>
                <p className="mt-2 text-sm text-slate-500">Этот email был указан при регистрации работника.</p>
              </div>

              <div className="rounded-2xl bg-slate-950/40 p-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-300">Уведомления на email</p>
                    <p className="mt-1 text-xs text-slate-500">Включить уведомления на email, указанный при регистрации.</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5" checked={emailNotificationsEnabled} onChange={(event) => setEmailNotificationsEnabled(event.target.checked)} />
                </label>
                <button onClick={saveSettings} disabled={savingSettings} className="mt-4 rounded-2xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70">
                  {savingSettings ? 'Сохраняю...' : 'Сохранить уведомления'}
                </button>
                {settingsState ? <p className={`mt-3 text-sm ${settingsState.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{settingsState.text}</p> : null}
              </div>

              <form onSubmit={savePassword} className="rounded-2xl bg-slate-950/40 p-4">
                <p className="text-sm text-slate-300">Смена пароля</p>
                <div className="mt-4 grid gap-3">
                  <input className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3" type="password" placeholder="Текущий пароль" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required />
                  <input className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3" type="password" placeholder="Новый пароль" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required />
                  <input className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3" type="password" placeholder="Повтори новый пароль" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required />
                </div>
                <button className="mt-4 rounded-2xl border border-white/10 px-4 py-3 text-sm" disabled={savingPassword}>
                  {savingPassword ? 'Меняю пароль...' : 'Сменить пароль'}
                </button>
                {passwordState ? <p className={`mt-3 text-sm ${passwordState.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{passwordState.text}</p> : null}
              </form>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-100/80">Чистый интерфейс</p>
            <h3 className="mt-3 text-2xl font-semibold">Без перегруза</h3>
            <p className="mt-3 text-sm text-emerald-50/80">Теперь в кабинете работника оставлены полезные вещи: профиль, переход в смены, email-уведомления и смена пароля.</p>
          </div>
        </section>
      </div>
    </WorkerShell>
  );
}
