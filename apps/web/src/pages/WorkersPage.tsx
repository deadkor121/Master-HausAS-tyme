import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ensureDemoAccessToken } from '../lib/auth';
import WorkerForm from '../components/WorkerForm';
import TimeEntryForm from '../components/TimeEntryForm';
import { formatNokFromOre } from '../lib/currency';

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
    const token = await ensureDemoAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setOrders(response.data.items ?? []);
  };

  const loadWorkers = async () => {
    const token = await ensureDemoAccessToken();
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
    if (!selectedWorker) {
      return;
    }

    loadWorkerTimeData(selectedWorker, selectedMonth);
  }, [selectedMonth]);

  const loadWorkerTimeData = async (worker: Worker, month = selectedMonth) => {
    const token = await ensureDemoAccessToken();
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
    const token = await ensureDemoAccessToken();
    await axios.delete(`${API_BASE}/api/v1/workers/${workerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (editingWorker?.id === workerId) {
      setEditingWorker(null);
    }
    if (salary && workers.find((worker) => worker.id === workerId)?.fullName === salary.workerName) {
      setSalary(null);
    }
    await loadWorkers();
  };

  const deleteTimeEntry = async (timeEntryId: string) => {
    const token = await ensureDemoAccessToken();
    await axios.delete(`${API_BASE}/api/v1/time-entries/${timeEntryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setEditingTimeEntry(null);
    if (selectedWorker) {
      await loadWorkerTimeData(selectedWorker, selectedMonth);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Workers & Salary</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Manage workers, skills and salary snapshots for the current reporting period.
            </p>
          </div>
          <Link to="/" className="rounded border border-slate-700 px-3 py-2 text-sm">Back home</Link>
        </div>

        <div className="mt-8 mb-6">
          <WorkerForm
            editingWorker={editingWorker}
            onSaved={async () => {
              setEditingWorker(null);
              await loadWorkers();
            }}
            onCancel={() => setEditingWorker(null)}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Brigade</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">{worker.fullName}</td>
                    <td className="px-4 py-3 capitalize">{worker.role}</td>
                    <td className="px-4 py-3">{worker.brigadeName}</td>
                    <td className="px-4 py-3">{formatNokFromOre(worker.hourlyRateOre)}/t</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950" onClick={() => loadWorkerTimeData(worker)}>
                          Hours
                        </button>
                        <button className="rounded border border-slate-700 px-3 py-1.5 text-sm" onClick={() => setEditingWorker(worker)}>
                          Edit
                        </button>
                        <button className="rounded border border-rose-700 px-3 py-1.5 text-sm text-rose-200" onClick={() => deleteWorker(worker.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Hours & salary</h2>
              <input
                className="w-28 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="YYYY-MM"
                pattern="\d{4}-\d{2}"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </div>
            {selectedWorker ? (
              <div className="mt-4 space-y-5 text-sm text-slate-300">
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
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p><span className="text-slate-500">Worker:</span> {salary.workerName}</p>
                    <p><span className="text-slate-500">Month:</span> {salary.month}</p>
                    <p><span className="text-slate-500">Regular hours:</span> {salary.regularHours}</p>
                    <p><span className="text-slate-500">Overtime hours:</span> {salary.overtimeHours}</p>
                    <p><span className="text-slate-500">Итоговая зарплата:</span> {formatNokFromOre(salary.totalPayOre)}</p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div>
                        <p className="font-medium text-cyan-300">{entry.month}</p>
                        <p className="text-slate-400">Regular: {entry.regularHours}h</p>
                        <p className="text-slate-400">Overtime: {entry.overtimeHours}h</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded border border-slate-700 px-3 py-1.5 text-sm" onClick={() => setEditingTimeEntry(entry)}>
                          Edit
                        </button>
                        <button className="rounded border border-rose-700 px-3 py-1.5 text-sm text-rose-200" onClick={() => deleteTimeEntry(entry.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {timeEntries.length === 0 ? <p className="text-slate-400">No time entries for this month.</p> : null}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Select a worker to manage hours and preview salary.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
