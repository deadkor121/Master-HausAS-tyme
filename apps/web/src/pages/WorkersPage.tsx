import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import WorkerForm from '../components/WorkerForm';
import { formatNokFromOre } from '../lib/currency';
import AdminShell from '../components/AdminShell';
import GeoWorkMap from '../components/GeoWorkMap';

type Worker = {
  id: string;
  fullName: string;
  role: string;
  hourlyRateOre: number;
  skillTags: string[];
  brigadeName: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  isActive: boolean;
};

type WorkerGeoStatus = {
  workerId: string;
  workerName: string;
  hasLeftSite: boolean;
  site: {
    id: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    leftAt?: string | null;
    lastPingAt?: string | null;
    lastPingLatitude?: number | null;
    lastPingLongitude?: number | null;
  } | null;
  latestReport: {
    id: string;
    workDate: string;
    photoUrl: string;
    photoUrls?: string[] | null;
    reportType?: string;
    note?: string | null;
  } | null;
};

type CalendarWorkerItem = {
  workerId: string;
  workerName: string;
  minutes: number;
  earnedOre: number;
  shifts: number;
};

type CalendarReportItem = {
  workerId: string;
  workerName: string;
  reportType: string;
  note: string | null;
  photoUrl: string;
  photoUrls: string[];
  createdAt: string;
};

type CalendarDay = {
  date: string;
  totalMinutes: number;
  totalEarnedOre: number;
  workers: CalendarWorkerItem[];
  reports: CalendarReportItem[];
};

const emptyMonthOverview: CalendarDay[] = [];

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatMinutes(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours} ч ${String(minutes).padStart(2, '0')} мин`;
}

function buildCalendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return [] as Array<Date | null>;
  }
  const firstDay = new Date(year, monthIndex - 1, 1);
  const lastDay = new Date(year, monthIndex, 0);
  const daysInMonth = lastDay.getDate();
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];

  for (let index = 0; index < mondayFirstOffset; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex - 1, day));
  return cells;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function WorkersPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [geoStatusMap, setGeoStatusMap] = useState<Record<string, WorkerGeoStatus>>({});
  const [workerActions, setWorkerActions] = useState<Record<string, 'none' | 'summary' | 'geo' | 'photos'>>({});

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(emptyMonthOverview);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(`${defaultMonth}-${String(now.getDate()).padStart(2, '0')}`);

  const loadWorkers = async () => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setWorkers(response.data.items ?? []);
  };

  const loadGeoStatuses = async () => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/geo-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const nextMap: Record<string, WorkerGeoStatus> = {};
    for (const item of response.data.items ?? []) {
      nextMap[item.workerId] = item;
    }
    setGeoStatusMap(nextMap);
  };

  const loadCalendarOverview = async (month: string) => {
    setIsLoadingCalendar(true);
    try {
      const token = ensureAccessToken();
      const response = await axios.get(`${API_BASE}/api/v1/workers/calendar-overview?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarDays(response.data.days ?? []);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  useEffect(() => {
    loadWorkers();
    loadGeoStatuses();
    loadCalendarOverview(selectedMonth);
  }, []);

  useEffect(() => {
    loadCalendarOverview(selectedMonth);
    const [year, monthIndex] = selectedMonth.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
      return;
    }
    const day = Math.min(new Date(year, monthIndex, 0).getDate(), Number(selectedDateKey.slice(8, 10)) || 1);
    setSelectedDateKey(`${selectedMonth}-${String(day).padStart(2, '0')}`);
  }, [selectedMonth]);

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

  const selectedDay = dayMap.get(selectedDateKey) ?? null;
  const calendarCells = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);

  const deleteWorker = async (workerId: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/workers/${workerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (editingWorker?.id === workerId) {
      setEditingWorker(null);
    }
    await loadWorkers();
    await loadGeoStatuses();
    await loadCalendarOverview(selectedMonth);
  };

  return (
    <AdminShell eyebrow="Team" title="Работники" description="Компактный обзор сотрудников, календарь по всей бригаде и фотоотчеты мастеров за выбранный день.">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
            <WorkerForm
              editingWorker={editingWorker}
              onSaved={async () => {
                setEditingWorker(null);
                await loadWorkers();
                await loadGeoStatuses();
                await loadCalendarOverview(selectedMonth);
              }}
              onCancel={() => setEditingWorker(null)}
            />
          </div>

          <div className="grid gap-3">
            {workers.map((worker) => {
              const geo = geoStatusMap[worker.id];
              const selectedAction = workerActions[worker.id] ?? 'none';
              const reportPhotos = Array.isArray(geo?.latestReport?.photoUrls)
                ? geo?.latestReport?.photoUrls ?? []
                : geo?.latestReport?.photoUrl ? [geo.latestReport.photoUrl] : [];

              return (
                <article key={worker.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {worker.photoUrl ? (
                        <img src={worker.photoUrl} alt={worker.fullName} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-sm font-semibold text-slate-950">
                          {initials(worker.fullName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{worker.fullName}</p>
                        <p className="truncate text-xs uppercase tracking-[0.15em] text-cyan-300">{worker.role}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${worker.isActive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-400/15 text-slate-300'}`}>
                        {worker.isActive ? 'Активен' : 'Не активен'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-md border border-white/15 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                        value={selectedAction}
                        onChange={(event) => {
                          const value = event.target.value as 'none' | 'summary' | 'geo' | 'photos';
                          setWorkerActions((previous) => ({ ...previous, [worker.id]: value }));
                        }}
                      >
                        <option value="none">Действие...</option>
                        <option value="summary">Кратко</option>
                        <option value="geo">Геолокация</option>
                        <option value="photos">Фотоотчет</option>
                      </select>
                      <button className="rounded-2xl border border-white/10 px-3 py-1 text-xs" onClick={() => setEditingWorker(worker)}>Редактировать</button>
                      <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-100" onClick={() => deleteWorker(worker.id)}>Удалить</button>
                    </div>
                  </div>

                  {selectedAction === 'summary' ? (
                    <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs sm:grid-cols-2">
                      <p><span className="text-slate-500">Ставка:</span> {formatNokFromOre(worker.hourlyRateOre)}/ч</p>
                      <p><span className="text-slate-500">Бригада:</span> {worker.brigadeName || 'Без бригады'}</p>
                      <p><span className="text-slate-500">Телефон:</span> {worker.phone || 'не указан'}</p>
                      <p><span className="text-slate-500">Email:</span> {worker.email || 'не указан'}</p>
                      <p className="sm:col-span-2"><span className="text-slate-500">Навыки:</span> {worker.skillTags.length ? worker.skillTags.join(', ') : 'не заполнены'}</p>
                    </div>
                  ) : null}

                  {selectedAction === 'geo' && geo?.site ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs">
                      <p><span className="text-slate-500">Адрес:</span> {geo.site.address}</p>
                      <p><span className="text-slate-500">Радиус:</span> {geo.site.radiusMeters} м</p>
                      <p><span className="text-slate-500">Последний пинг:</span> {geo.site.lastPingAt ? new Date(geo.site.lastPingAt).toLocaleString('ru-RU') : 'нет данных'}</p>
                      <p className={geo.hasLeftSite ? 'text-rose-300' : 'text-emerald-300'}>
                        {geo.hasLeftSite
                          ? `Вышел из зоны: ${geo.site.leftAt ? new Date(geo.site.leftAt).toLocaleString('ru-RU') : 'время не зафиксировано'}`
                          : 'Внутри зоны'}
                      </p>
                      <div className="mt-3">
                        <GeoWorkMap
                          workSite={{
                            address: geo.site.address,
                            latitude: geo.site.latitude,
                            longitude: geo.site.longitude,
                            radiusMeters: geo.site.radiusMeters
                          }}
                          workerPoint={geo.site.lastPingLatitude !== null && geo.site.lastPingLatitude !== undefined && geo.site.lastPingLongitude !== null && geo.site.lastPingLongitude !== undefined
                            ? {
                                latitude: geo.site.lastPingLatitude,
                                longitude: geo.site.lastPingLongitude,
                                label: 'Последний геопинг'
                              }
                            : null}
                          heightClassName="h-56"
                        />
                      </div>
                    </div>
                  ) : null}

                  {selectedAction === 'photos' ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs">
                      {geo?.latestReport ? (
                        <>
                          <p className="text-slate-400">Дата: {String(geo.latestReport.workDate).slice(0, 10)}</p>
                          <p className="text-slate-400">Тип: {geo.latestReport.reportType === 'start' ? 'Старт смены' : 'Завершение/дневной отчет'}</p>
                          {geo.latestReport.note ? <p className="mt-1 text-slate-300">{geo.latestReport.note}</p> : null}
                          {reportPhotos.length > 0 ? (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {reportPhotos.map((photoUrl, index) => (
                                <img key={`${worker.id}-${index}`} src={photoUrl} alt={`Report ${index + 1}`} className="h-24 w-full rounded-lg object-cover" />
                              ))}
                            </div>
                          ) : <p className="mt-1 text-slate-500">Фото не загружены.</p>}
                        </>
                      ) : (
                        <p className="text-slate-500">У работника пока нет фотоотчета.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold">Календарь всей команды</h2>
            <input
              className="w-40 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </div>

          <p className="mt-2 text-sm text-slate-400">Нажмите на день: увидите всех работников, часы и фотоотчеты за выбранную дату.</p>

          <div className="mt-5 grid grid-cols-7 gap-2 text-xs text-slate-500">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName) => (
              <p key={dayName} className="text-center">{dayName}</p>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarCells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-20 rounded-xl border border-white/5 bg-slate-950/20" />;
              }

              const key = toDateKey(date);
              const day = dayMap.get(key);
              const isSelected = key === selectedDateKey;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDateKey(key)}
                  className={`h-20 rounded-xl border p-2 text-left transition ${isSelected ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 bg-slate-950/30 hover:border-white/20'}`}
                >
                  <p className="text-sm font-semibold text-white">{date.getDate()}</p>
                  {day ? (
                    <>
                      <p className="mt-1 text-[11px] text-cyan-300">{formatMinutes(day.totalMinutes)}</p>
                      <p className="text-[10px] text-amber-300">{formatNokFromOre(day.totalEarnedOre)}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-500">Нет данных</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
            <h3 className="text-lg font-semibold">{selectedDateKey}</h3>
            {isLoadingCalendar ? <p className="mt-2 text-sm text-slate-400">Загрузка...</p> : null}

            {selectedDay ? (
              <>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Работники за день</p>
                    <div className="mt-2 space-y-2">
                      {selectedDay.workers.map((worker) => (
                        <div key={`${selectedDay.date}-${worker.workerId}`} className="rounded-lg border border-white/10 bg-slate-900/40 p-2 text-xs">
                          <p className="font-semibold text-white">{worker.workerName}</p>
                          <p className="text-slate-400">{formatMinutes(worker.minutes)} • {formatNokFromOre(worker.earnedOre)} • смен: {worker.shifts}</p>
                        </div>
                      ))}
                      {selectedDay.workers.length === 0 ? <p className="text-xs text-slate-500">Нет рабочих записей.</p> : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Фотоотчеты за день</p>
                    <div className="mt-2 space-y-3">
                      {selectedDay.reports.map((report, index) => (
                        <div key={`${selectedDay.date}-${report.workerId}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/40 p-2 text-xs">
                          <p className="font-semibold text-white">{report.workerName}</p>
                          <p className="text-slate-400">{report.reportType === 'start' ? 'Старт смены' : 'Завершение/дневной отчет'}</p>
                          {report.note ? <p className="mt-1 text-slate-300">{report.note}</p> : null}
                          {report.photoUrls.length > 0 ? (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {report.photoUrls.map((photoUrl, photoIndex) => (
                                <img key={`${photoUrl}-${photoIndex}`} src={photoUrl} alt={`Report photo ${photoIndex + 1}`} className="h-24 w-full rounded-lg object-cover" />
                              ))}
                            </div>
                          ) : <p className="mt-1 text-slate-500">Фото не приложены.</p>}
                        </div>
                      ))}
                      {selectedDay.reports.length === 0 ? <p className="text-xs text-slate-500">Нет фотоотчетов за этот день.</p> : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400">За выбранный день пока нет данных.</p>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
