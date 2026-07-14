import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import WorkerForm from '../components/WorkerForm';
import TimeEntryForm from '../components/TimeEntryForm';
import { formatNokFromOre } from '../lib/currency';
import AdminShell from '../components/AdminShell';

type Worker = {
  id: string;
  fullName: string;
  role: string;
  hourlyRateOre: number;
  skillTags: string[];
  brigadeName: string;
  isActive: boolean;
};

type Salary = {
  workerName: string;
  month: string;
  regularHours: number;
  overtimeHours: number;
  totalPayOre: number;
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

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('2026-07');

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

  useEffect(() => {
    loadWorkers();
    loadOrders();
  }, []);

  useEffect(() => {
    if (!selectedWorker) return;
    loadWorkerTimeData(selectedWorker, selectedMonth);
  }, [selectedMonth]);

  const loadWorkerTimeData = async (worker: Worker, month = selectedMonth) => {
    const token = ensureAccessToken();
    const [salaryResponse, entriesResponse] = await Promise.all([
      axios.get(`${API_BASE}/api/v1/workers/${worker.id}/salary?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(`${API_BASE}/api/v1/workers/${worker.id}/time-entries?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);
    setSelectedWorker(worker);
    setSalary(salaryResponse.data);
    setTimeEntries(entriesResponse.data.items ?? []);
  };

  const deleteWorker = async (workerId: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/workers/${workerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (editingWorker?.id === workerId) setEditingWorker(null);
    if (salary && workers.find((worker) => worker.id === workerId)?.fullName === salary.workerName) setSalary(null);
    await loadWorkers();
  };

  const deleteTimeEntry = async (timeEntryId: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/time-entries/${timeEntryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setEditingTimeEntry(null);
    if (selectedWorker) await loadWorkerTimeData(selectedWorker, selectedMonth);
  };

  return (
    <AdminShell eyebrow="Team" title="Работники и зарплата" description="Карточки сотрудников, часы, месячные табели и зарплатные срезы — теперь в более собранном и удобном интерфейсе.">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-4">Name</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Brigade</th>
                  <th className="px-4 py-4">Rate</th>
                  <th className="px-4 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-t border-white/10">
                    <td className="px-4 py-4 font-medium">{worker.fullName}</td>
                    <td className="px-4 py-4 capitalize text-slate-400">{worker.role}</td>
                    <td className="px-4 py-4 text-slate-400">{worker.brigadeName}</td>
                    <td className="px-4 py-4 text-cyan-300">{formatNokFromOre(worker.hourlyRateOre)}/t</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-2xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950" onClick={() => loadWorkerTimeData(worker)}>Hours</button>
                        <button className="rounded-2xl border border-white/10 px-3 py-2 text-sm" onClick={() => setEditingWorker(worker)}>Edit</button>
                        <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" onClick={() => deleteWorker(worker.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold">Часы и зарплата</h2>
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
                <div className="space-y-2 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
                  <p><span className="text-slate-500">Worker:</span> {salary.workerName}</p>
                  <p><span className="text-slate-500">Month:</span> {salary.month}</p>
                  <p><span className="text-slate-500">Regular hours:</span> {salary.regularHours}</p>
                  <p><span className="text-slate-500">Overtime hours:</span> {salary.overtimeHours}</p>
                  <p><span className="text-slate-500">Итоговая зарплата:</span> {formatNokFromOre(salary.totalPayOre)}</p>
                </div>
              ) : null}

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
          ) : <p className="mt-4 text-sm text-slate-400">Выбери работника, чтобы увидеть табель и зарплату.</p>}
        </div>
      </div>
    </AdminShell>
  );
}

