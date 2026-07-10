import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ensureDemoAccessToken } from '../lib/auth';

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
  return new Date(isoString).toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildCalendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1);
  const lastDay = new Date(year, monthIndex, 0);
  const daysInMonth = lastDay.getDate();
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];

  for (let index = 0; index < mondayFirstOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex - 1, day));
  }

  return cells;
}

export default function WorkerAttendancePage() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const defaultDate = `${defaultMonth}-${String(today.getDate()).padStart(2, '0')}`;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [form, setForm] = useState({
    workDate: defaultDate,
    startedAt: '08:00',
    endedAt: '16:00'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadWorkers = async () => {
    const token = await ensureDemoAccessToken();
    const response = await axios.get('/api/v1/workers', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const items = response.data.items ?? [];
    setWorkers(items);
    if (!selectedWorkerId && items.length > 0) {
      setSelectedWorkerId(items[0].id);
    }
  };

  const loadWorkLogs = async (workerId: string, month: string) => {
    const token = await ensureDemoAccessToken();
    const response = await axios.get(`/api/v1/workers/${workerId}/work-logs?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setWorkLogs(response.data.items ?? []);
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  useEffect(() => {
    if (!selectedWorkerId) {
      return;
    }

    loadWorkLogs(selectedWorkerId, selectedMonth);
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
      const token = await ensureDemoAccessToken();
      const payload = {
        workDate: form.workDate,
        startedAt: form.startedAt,
        endedAt: form.endedAt
      };

      if (editingLogId) {
        await axios.put(`/api/v1/work-logs/${editingLogId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`/api/v1/workers/${selectedWorkerId}/work-logs`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      await loadWorkLogs(selectedWorkerId, selectedMonth);
      setEditingLogId(null);
      setFeedback({ type: 'success', text: 'Выход на работу сохранён.' });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage = typeof error.response?.data?.error === 'string' ? error.response.data.error : '';
        setFeedback({ type: 'error', text: apiMessage || 'Не удалось сохранить рабочее время.' });
      } else {
        setFeedback({ type: 'error', text: 'Не удалось сохранить рабочее время.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (log: WorkLog) => {
    setEditingLogId(log.id);
    setForm({
      workDate: getDateKey(log.workDate),
      startedAt: formatTimeLabel(log.startedAt),
      endedAt: formatTimeLabel(log.endedAt)
    });
    setFeedback(null);
  };

  const removeLog = async (logId: string) => {
    const token = await ensureDemoAccessToken();
    await axios.delete(`/api/v1/work-logs/${logId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (editingLogId === logId) {
      setEditingLogId(null);
    }
    await loadWorkLogs(selectedWorkerId, selectedMonth);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Attendance</p>
            <h1 className="text-3xl font-semibold">Рабочие смены сотрудника</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Отдельная страница для отметки выхода на работу: день в календаре, время начала и окончания смены, а также суммарно потраченное время.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/workers" className="rounded border border-slate-700 px-3 py-2 text-sm">К работникам</Link>
            <Link to="/" className="rounded border border-slate-700 px-3 py-2 text-sm">На главную</Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Рабочих дней</p>
            <p className="mt-2 text-3xl font-semibold text-cyan-300">{workedDaysCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Всего времени за месяц</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-300">{formatMinutes(totalWorkedMinutes)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Месяц</p>
            <input className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
              <h2 className="text-lg font-semibold">{editingLogId ? 'Редактировать смену' : 'Отметить выход на работу'}</h2>

              {feedback ? (
                <div className={`rounded border px-3 py-2 text-sm ${feedback.type === 'success' ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200' : 'border-rose-700/40 bg-rose-500/10 text-rose-200'}`}>
                  {feedback.text}
                </div>
              ) : null}

              <div className="grid gap-1">
                <label className="text-slate-300">Сотрудник</label>
                <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)}>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>{worker.fullName} ({worker.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-slate-300">День в календаре</label>
                <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="date" value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-slate-300">Начал работу</label>
                  <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="time" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} required />
                </div>
                <div className="grid gap-1">
                  <label className="text-slate-300">Закончил работу</label>
                  <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" type="time" value={form.endedAt} onChange={(event) => setForm({ ...form, endedAt: event.target.value })} required />
                </div>
              </div>

              <div className="flex gap-3">
                <button className="rounded bg-cyan-500 px-3 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Сохраняю...' : editingLogId ? 'Сохранить смену' : 'Отметить смену'}
                </button>
                {editingLogId ? (
                  <button
                    type="button"
                    className="rounded border border-slate-700 px-3 py-2"
                    onClick={() => {
                      setEditingLogId(null);
                      setForm({ workDate: defaultDate, startedAt: '08:00', endedAt: '16:00' });
                      setFeedback(null);
                    }}
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
            </form>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="text-lg font-semibold">Выходы на работу</h2>
              <div className="mt-4 space-y-3">
                {workLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
                    <div>
                      <p className="font-medium text-cyan-300">{formatDateLabel(log.workDate)}</p>
                      <p className="text-slate-400">{formatTimeLabel(log.startedAt)} - {formatTimeLabel(log.endedAt)}</p>
                      <p className="text-slate-500">Потрачено: {formatMinutes(log.totalMinutes)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded border border-slate-700 px-3 py-1.5" onClick={() => startEditing(log)}>
                        Изменить
                      </button>
                      <button className="rounded border border-rose-700 px-3 py-1.5 text-rose-200" onClick={() => removeLog(log.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
                {workLogs.length === 0 ? <p className="text-sm text-slate-400">За выбранный месяц выходов на работу пока нет.</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-lg font-semibold">Календарь выходов</h2>
            <p className="mt-2 text-sm text-slate-400">Нажмите на день, чтобы быстро подставить его в форму слева. Дни, в которые уже была смена, подсвечены и показывают потраченное время.</p>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
              <div>Пн</div>
              <div>Вт</div>
              <div>Ср</div>
              <div>Чт</div>
              <div>Пт</div>
              <div>Сб</div>
              <div>Вс</div>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="min-h-24 rounded-xl border border-transparent" />;
                }

                const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const dayMinutes = logsByDate.get(dateKey) ?? 0;
                const isSelected = form.workDate === dateKey;

                return (
                  <button
                    type="button"
                    key={dateKey}
                    onClick={() => setForm({ ...form, workDate: dateKey })}
                    className={`min-h-24 rounded-xl border p-3 text-left ${isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/50'} ${dayMinutes > 0 ? 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]' : ''}`}
                  >
                    <div className="text-sm font-medium text-slate-100">{day.getDate()}</div>
                    {dayMinutes > 0 ? (
                      <div className="mt-3 text-xs text-emerald-300">{formatMinutes(dayMinutes)}</div>
                    ) : (
                      <div className="mt-3 text-xs text-slate-500">Нет смены</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}