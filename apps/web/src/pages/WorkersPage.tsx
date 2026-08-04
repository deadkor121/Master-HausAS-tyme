import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import WorkerForm from '../components/WorkerForm';
import TimeEntryForm from '../components/TimeEntryForm';
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

type Salary = {
  workerName: string;
  month: string;
  regularHours: number;
  overtimeHours: number;
  totalPayOre: number;
  advancesPaidOre: number;
  remainingPayOre: number;
};

type Order = {
  id: string;
  orderNumber: string;
  title: string;
};

type TimeEntry = {
  id: string;
  workerId: string;
  orderId: string;
  month: string;
  regularHours: number;
  overtimeHours: number;
};

type WorkerAdvance = {
  id: string;
  amountOre: number;
  advanceDate: string;
  note?: string | null;
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
    lastDistanceMeters?: number | null;
  } | null;
  latestReport: {
    id: string;
    workDate: string;
    photoUrl: string;
    note?: string | null;
  } | null;
};

const emptyAdvanceForm = {
  advanceDate: '',
  amountNok: '',
  note: ''
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [advances, setAdvances] = useState<WorkerAdvance[]>([]);
  const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
  const [isSavingAdvance, setIsSavingAdvance] = useState(false);
  const [geoStatusMap, setGeoStatusMap] = useState<Record<string, WorkerGeoStatus>>({});

  const loadOrders = async () => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setOrders(response.data.items ?? []);
  };

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

  useEffect(() => {
    loadWorkers();
    loadOrders();
    loadGeoStatuses();
  }, []);

  useEffect(() => {
    if (!selectedWorker) return;
    loadWorkerTimeData(selectedWorker, selectedMonth);
  }, [selectedMonth]);

  const loadWorkerTimeData = async (worker: Worker, month = selectedMonth) => {
    const token = ensureAccessToken();
    const [salaryResponse, entriesResponse, advancesResponse] = await Promise.all([
      axios.get(`${API_BASE}/api/v1/workers/${worker.id}/salary?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(`${API_BASE}/api/v1/workers/${worker.id}/time-entries?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(`${API_BASE}/api/v1/workers/${worker.id}/advances?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);
    setSelectedWorker(worker);
    setSalary(salaryResponse.data);
    setTimeEntries(entriesResponse.data.items ?? []);
    setAdvances(advancesResponse.data.items ?? []);
    setAdvanceForm((previous) => ({ ...previous, advanceDate: previous.advanceDate || `${month}-01` }));
  };

  const deleteWorker = async (workerId: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/workers/${workerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (editingWorker?.id === workerId) setEditingWorker(null);
    if (selectedWorker?.id === workerId) {
      setSelectedWorker(null);
      setSalary(null);
      setAdvances([]);
      setTimeEntries([]);
    }
    await loadWorkers();
    await loadGeoStatuses();
  };

  const deleteTimeEntry = async (timeEntryId: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/time-entries/${timeEntryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setEditingTimeEntry(null);
    if (selectedWorker) await loadWorkerTimeData(selectedWorker, selectedMonth);
  };

  const createAdvance = async () => {
    if (!selectedWorker || !advanceForm.advanceDate || !advanceForm.amountNok) {
      return;
    }

    setIsSavingAdvance(true);
    try {
      const token = ensureAccessToken();
      await axios.post(
        `${API_BASE}/api/v1/workers/${selectedWorker.id}/advances`,
        {
          advanceDate: advanceForm.advanceDate,
          amountOre: Math.round(Number(advanceForm.amountNok) * 100),
          note: advanceForm.note.trim() || undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAdvanceForm({ ...emptyAdvanceForm, advanceDate: `${selectedMonth}-01` });
      await loadWorkerTimeData(selectedWorker, selectedMonth);
    } finally {
      setIsSavingAdvance(false);
    }
  };

  const deleteAdvance = async (advanceId: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/worker-advances/${advanceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (selectedWorker) {
      await loadWorkerTimeData(selectedWorker, selectedMonth);
    }
  };

  return (
    <AdminShell eyebrow="Team" title="Работники и зарплата" description="Профессиональные карточки сотрудников, часы, авансы и месячные зарплатные срезы в одном месте.">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
            <WorkerForm
              editingWorker={editingWorker}
              onSaved={async () => {
                setEditingWorker(null);
                await loadWorkers();
              }}
              onCancel={() => setEditingWorker(null)}
            />
          </div>

          <div className="grid gap-4">
            {workers.map((worker) => (
              <article key={worker.id} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
                <div className="grid gap-0 md:grid-cols-[140px_1fr]">
                  <div className="flex min-h-[180px] items-center justify-center bg-slate-950/50 p-4">
                    {worker.photoUrl ? (
                      <img src={worker.photoUrl} alt={worker.fullName} className="h-28 w-28 rounded-[1.5rem] object-cover shadow-lg shadow-black/20" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-[1.5rem] bg-cyan-400 text-2xl font-semibold text-slate-950">
                        {initials(worker.fullName)}
                      </div>
                    )}
                  </div>

                  <div className="p-5 md:p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-white">{worker.fullName}</h2>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${worker.isActive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-400/15 text-slate-300'}`}>
                            {worker.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm uppercase tracking-[0.2em] text-cyan-300">{worker.role}</p>
                        {worker.bio ? <p className="mt-3 max-w-2xl text-sm text-slate-400">{worker.bio}</p> : null}
                      </div>
                      <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm">
                        <p className="text-slate-500">Ставка</p>
                        <p className="mt-1 text-lg font-semibold text-cyan-300">{formatNokFromOre(worker.hourlyRateOre)}/час</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4 text-sm">
                        <p className="text-slate-500">Контакты</p>
                        <p className="mt-2">{worker.phone || 'Телефон не указан'}</p>
                        <p className="text-slate-400">{worker.email || 'Email не указан'}</p>
                      </div>
                      <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4 text-sm">
                        <p className="text-slate-500">Команда и навыки</p>
                        <p className="mt-2">{worker.brigadeName || 'Без бригады'}</p>
                        <p className="text-slate-400">{worker.skillTags.length ? worker.skillTags.join(', ') : 'Навыки ещё не заполнены'}</p>
                      </div>
                    </div>

                    {geoStatusMap[worker.id]?.site ? (
                      (() => {
                        const site = geoStatusMap[worker.id].site;
                        if (!site) return null;
                        const workerPoint = site.lastPingLatitude !== null && site.lastPingLatitude !== undefined && site.lastPingLongitude !== null && site.lastPingLongitude !== undefined
                          ? {
                              latitude: site.lastPingLatitude,
                              longitude: site.lastPingLongitude,
                              label: 'Последний геопинг'
                            }
                          : null;

                        return (
                      <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4 text-sm">
                        <p className="text-slate-500">Геозона работ</p>
                        <p className="mt-2">{site.address}</p>
                        <p className="text-slate-400">Радиус: {site.radiusMeters} м</p>
                        <p className="text-slate-400">Последний геопинг: {site.lastPingAt ? new Date(site.lastPingAt).toLocaleString('ru-RU') : 'нет данных'}</p>
                        <p className={geoStatusMap[worker.id].hasLeftSite ? 'text-rose-300' : 'text-emerald-300'}>
                          {geoStatusMap[worker.id].hasLeftSite
                            ? `Покинул адрес: ${site.leftAt ? new Date(site.leftAt).toLocaleString('ru-RU') : 'время не зафиксировано'}`
                            : 'Внутри рабочей зоны'}
                        </p>
                        <div className="mt-4">
                          <GeoWorkMap
                            workSite={{
                              address: site.address,
                              latitude: site.latitude,
                              longitude: site.longitude,
                              radiusMeters: site.radiusMeters
                            }}
                            workerPoint={workerPoint}
                            heightClassName="h-64"
                          />
                        </div>
                      </div>
                        );
                      })()
                    ) : null}

                    {geoStatusMap[worker.id]?.latestReport ? (
                      <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4 text-sm">
                        <p className="text-slate-500">Последний фотоотчет</p>
                        <p className="mt-2 text-slate-400">Дата: {String(geoStatusMap[worker.id].latestReport?.workDate).slice(0, 10)}</p>
                        <img src={geoStatusMap[worker.id].latestReport?.photoUrl} alt="Worker latest report" className="mt-2 h-32 w-full rounded-xl object-cover" />
                        {geoStatusMap[worker.id].latestReport?.note ? <p className="mt-2">{geoStatusMap[worker.id].latestReport?.note}</p> : null}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button className="rounded-2xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950" onClick={() => loadWorkerTimeData(worker)}>Hours & salary</button>
                      <button className="rounded-2xl border border-white/10 px-3 py-2 text-sm" onClick={() => setEditingWorker(worker)}>Edit card</button>
                      <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" onClick={() => deleteWorker(worker.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold">Часы, зарплата и авансы</h2>
            <input className="w-36 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm" placeholder="YYYY-MM" pattern="\d{4}-\d{2}" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </div>
          {selectedWorker ? (
            <div className="mt-5 space-y-5 text-sm text-slate-300">
              <TimeEntryForm
                workerId={selectedWorker.id}
                orders={orders}
                editingEntry={editingTimeEntry}
                month={selectedMonth}
                onSaved={async () => {
                  setEditingTimeEntry(null);
                  await loadWorkerTimeData(selectedWorker, selectedMonth);
                }}
                onCancel={() => setEditingTimeEntry(null)}
              />

              {salary ? (
                <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-2">
                  <p><span className="text-slate-500">Worker:</span> {salary.workerName}</p>
                  <p><span className="text-slate-500">Month:</span> {salary.month}</p>
                  <p><span className="text-slate-500">Regular hours:</span> {salary.regularHours}</p>
                  <p><span className="text-slate-500">Overtime hours:</span> {salary.overtimeHours}</p>
                  <p><span className="text-slate-500">Начислено:</span> {formatNokFromOre(salary.totalPayOre)}</p>
                  <p><span className="text-slate-500">Выдано авансом:</span> {formatNokFromOre(salary.advancesPaidOre)}</p>
                  <p className="sm:col-span-2"><span className="text-slate-500">Осталось выплатить:</span> <span className="font-semibold text-cyan-300">{formatNokFromOre(salary.remainingPayOre)}</span></p>
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-4 flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-white">Добавить аванс</h3>
                  <p className="text-slate-400">Сохраняется сумма, день выдачи и заметка.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input type="date" className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm" value={advanceForm.advanceDate} onChange={(event) => setAdvanceForm((previous) => ({ ...previous, advanceDate: event.target.value }))} />
                  <input type="number" min="0" step="0.01" placeholder="Сумма в NOK" className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm" value={advanceForm.amountNok} onChange={(event) => setAdvanceForm((previous) => ({ ...previous, amountNok: event.target.value }))} />
                  <input type="text" placeholder="Заметка" className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm" value={advanceForm.note} onChange={(event) => setAdvanceForm((previous) => ({ ...previous, note: event.target.value }))} />
                </div>
                <button className="mt-3 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSavingAdvance || !advanceForm.advanceDate || !advanceForm.amountNok} onClick={createAdvance}>
                  {isSavingAdvance ? 'Saving...' : 'Добавить аванс'}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Авансы за месяц</h3>
                {advances.map((advance) => (
                  <div key={advance.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-emerald-300">{formatNokFromOre(advance.amountOre)}</p>
                      <p className="text-slate-400">Дата: {String(advance.advanceDate).slice(0, 10)}</p>
                      {advance.note ? <p className="text-slate-500">{advance.note}</p> : null}
                    </div>
                    <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" onClick={() => deleteAdvance(advance.id)}>Delete</button>
                  </div>
                ))}
                {advances.length === 0 ? <p className="text-slate-400">За этот месяц авансов пока нет.</p> : null}
              </div>

              <div className="space-y-3">
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-cyan-300">{entry.month}</p>
                      <p className="text-slate-400">Regular: {entry.regularHours}h</p>
                      <p className="text-slate-400">Overtime: {entry.overtimeHours}h</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-2xl border border-white/10 px-3 py-2 text-sm" onClick={() => setEditingTimeEntry(entry)}>Edit</button>
                      <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" onClick={() => deleteTimeEntry(entry.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                {timeEntries.length === 0 ? <p className="text-slate-400">No time entries for this month.</p> : null}
              </div>
            </div>
          ) : <p className="mt-4 text-sm text-slate-400">Выбери работника, чтобы увидеть табель, авансы и зарплату.</p>}
        </div>
      </div>
    </AdminShell>
  );
}
