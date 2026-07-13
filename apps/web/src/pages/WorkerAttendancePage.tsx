import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ensureAccessToken, describeAxiosError } from '../lib/auth';
import { useAuth } from '../lib/AuthContext';
import WorkerShell from '../components/WorkerShell';
import AdminShell from '../components/AdminShell';

type Worker = {
  id: string;
  fullName: string;
  role: string;
};

type WorkLog = {
  id: string;
  workDate: string;
  startedAt: string;
  endedAt: string;
  totalMinutes: number;
};

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
}

function getDateKey(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString.slice(0, 10);
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(isoString: string) {
  return new Date(isoString).toLocaleDateString('ru-RU');
}

function formatTimeLabel(isoString: string) {
  return new Date(isoString).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function buildCalendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1);
  const lastDay = new Date(year, monthIndex, 0);
  const daysInMonth = lastDay.getDate();
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];

  for (let index = 0; index < mondayFirstOffset; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex - 1, day));
  return cells;
}

export default function WorkerAttendancePage() {
  const { user } = useAuth();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const defaultDate = `${defaultMonth}-${String(today.getDate()).padStart(2, '0')}`;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(user?.role === 'worker' ? user.workerId ?? '' : '');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [form, setForm] = useState({ workDate: defaultDate, startedAt: '08:00', endedAt: '16:00' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isWorkerOnly = user?.role === 'worker';

  const loadWorkers = async () => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/directory`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const items = response.data.items ?? [];
    setWorkers(items);

    if (isWorkerOnly) {
      setSelectedWorkerId(user?.workerId ?? '');
      return;
    }

    if (!selectedWorkerId && items.length > 0) {
      setSelectedWorkerId(items[0].id);
    }
  };

  const loadWorkLogs = async (workerId: string, month: string) => {
    if (!workerId) {
      setWorkLogs([]);
      return;
    }

    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/${workerId}/work-logs?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setWorkLogs(response.data.items ?? []);
  };

  useEffect(() => {
    loadWorkers().catch((error) => setFeedback({ type: 'error', text: describeAxiosError(error) }));
  }, []);

  useEffect(() => {
    if (!selectedWorkerId) return;
    loadWorkLogs(selectedWorkerId, selectedMonth).catch((error) => setFeedback({ type: 'error', text: describeAxiosError(error) }));
  }, [selectedWorkerId, selectedMonth]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of workLogs) {
      const key = getDateKey(log.workDate);
      map.set(key, (map.get(key) ?? 0) + log.totalMinutes);
    }
    return map;
  }, [workLogs]);

  const totalWorkedMinutes = workLogs.reduce((sum, log) => sum + log.totalMinutes, 0);
  const workedDaysCount = logsByDate.size;
  const calendarDays = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала выберите работника.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const token = ensureAccessToken();
      const payload = { workDate: form.workDate, startedAt: form.startedAt, endedAt: form.endedAt };

      if (editingLogId) {
        await axios.put(`${API_BASE}/api/v1/work-logs/${editingLogId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/api/v1/workers/${selectedWorkerId}/work-logs`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      await loadWorkLogs(selectedWorkerId, selectedMonth);
      setEditingLogId(null);
      setFeedback({ type: 'success', text: 'Рабочее время сохранено.' });
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) || 'Не удалось сохранить рабочее время.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (log: WorkLog) => {
    setEditingLogId(log.id);
    setForm({ workDate: getDateKey(log.workDate), startedAt: formatTimeLabel(log.startedAt), endedAt: formatTimeLabel(log.endedAt) });
    setFeedback(null);
  };

  const removeLog = async (logId: string) => {
    try {
      const token = ensureAccessToken();
      await axios.delete(`${API_BASE}/api/v1/work-logs/${logId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (editingLogId === logId) setEditingLogId(null);
      await loadWorkLogs(selectedWorkerId, selectedMonth);
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    }
  };

  const content = (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Рабочих дней</p>
          <p className="mt-3 text-4xl font-semibold text-cyan-300">{workedDaysCount}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Всего за месяц</p>
          <p className="mt-3 text-4xl font-semibold text-emerald-300">{formatMinutes(totalWorkedMinutes)}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Месяц</p>
          <input className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <form onSubmit={submit} className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
            <div>
              <h2 className="text-2xl font-semibold">{editingLogId ? 'Редактировать смену' : 'Добавить смену'}</h2>
              <p className="mt-2 text-sm text-slate-400">{isWorkerOnly ? 'Личный табель без лишних админских блоков.' : 'Админский режим для управления табелями сотрудников.'}</p>
            </div>

            {feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200' : 'border-rose-700/40 bg-rose-500/10 text-rose-200'}`}>{feedback.text}</div> : null}

            <div className="grid gap-1">
              <label className="text-sm text-slate-300">Сотрудник</label>
              <select className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)} disabled={isWorkerOnly}>
                {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.fullName} ({worker.role})</option>)}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-1 md:col-span-1">
                <label className="text-sm text-slate-300">Дата</label>
                <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="date" value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} required />
              </div>
              <div className="grid gap-1">
                <label className="text-sm text-slate-300">Начало</label>
                <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="time" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} required />
              </div>
              <div className="grid gap-1">
                <label className="text-sm text-slate-300">Конец</label>
                <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="time" value={form.endedAt} onChange={(event) => setForm({ ...form, endedAt: event.target.value })} required />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Сохраняю...' : editingLogId ? 'Сохранить изменения' : 'Добавить смену'}</button>
              {editingLogId ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => { setEditingLogId(null); setForm({ workDate: defaultDate, startedAt: '08:00', endedAt: '16:00' }); setFeedback(null); }}>Отмена</button> : null}
            </div>
          </form>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
            <h2 className="text-2xl font-semibold">Журнал смен</h2>
            <div className="mt-4 space-y-3">
              {workLogs.map((log) => (
                <div key={log.id} className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-cyan-300">{formatDateLabel(log.workDate)}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatTimeLabel(log.startedAt)} - {formatTimeLabel(log.endedAt)}</p>
                    <p className="mt-1 text-sm text-slate-500">Потрачено: {formatMinutes(log.totalMinutes)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-2xl border border-white/10 px-4 py-2 text-sm" onClick={() => startEditing(log)}>Изменить</button>
                    <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100" onClick={() => removeLog(log.id)}>Удалить</button>
                  </div>
                </div>
              ))}
              {workLogs.length === 0 ? <p className="text-sm text-slate-400">За выбранный месяц смен пока нет.</p> : null}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <h2 className="text-2xl font-semibold">Календарь</h2>
          <p className="mt-2 text-sm text-slate-400">Нажми на день, чтобы быстро подставить дату в форму. Отработанные дни подсвечиваются и показывают суммарное время.</p>
          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="min-h-24 rounded-2xl border border-transparent" />;
              const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const dayMinutes = logsByDate.get(dateKey) ?? 0;
              const isSelected = form.workDate === dateKey;
              return (
                <button key={dateKey} type="button" onClick={() => setForm({ ...form, workDate: dateKey })} className={`min-h-24 rounded-2xl border p-3 text-left transition ${isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40'} ${dayMinutes > 0 ? 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]' : ''}`}>
                  <div className="text-sm font-medium text-slate-100">{day.getDate()}</div>
                  {dayMinutes > 0 ? <div className="mt-3 text-xs text-emerald-300">{formatMinutes(dayMinutes)}</div> : <div className="mt-3 text-xs text-slate-500">Нет смены</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  return isWorkerOnly ? (
    <WorkerShell title="Мои смены" description="Чистый личный табель: только твои рабочие записи, календарь и быстрый ввод времени.">{content}</WorkerShell>
  ) : (
    <AdminShell title="Учёт рабочего времени" eyebrow="Attendance" description="Админский обзор смен сотрудников с быстрым редактированием и календарём.">{content}</AdminShell>
  );
}
