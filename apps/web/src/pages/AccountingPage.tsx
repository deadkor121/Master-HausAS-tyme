import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import FinanceEntryForm from '../components/FinanceEntryForm';
import { formatNokFromOre } from '../lib/currency';
import AdminShell from '../components/AdminShell';

type Order = {
  id: string;
  orderNumber: string;
  title: string;
};

type FinanceReport = {
  month: string;
  revenue: number;
  expenses: {
    salaries: number;
    materials: number;
    other: number;
  };
  netProfit: number;
};

type Payment = {
  id: string;
  orderId: string;
  amountOre: number;
  month: string;
};

type Expense = {
  id: string;
  category: string;
  amountOre: number;
  month: string;
};

export default function AccountingPage() {
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const loadReport = async () => {
    const token = ensureAccessToken();
    const [reportResponse, paymentsResponse, expensesResponse, ordersResponse] = await Promise.all([
      axios.get(`${API_BASE}/api/v1/finance/monthly-report?month=2026-07`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_BASE}/api/v1/payments?month=2026-07`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_BASE}/api/v1/expenses?month=2026-07`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_BASE}/api/v1/orders`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    setReport(reportResponse.data);
    setPayments(paymentsResponse.data.items ?? []);
    setExpenses(expensesResponse.data.items ?? []);
    setOrders(ordersResponse.data.items ?? []);
  };

  useEffect(() => {
    loadReport();
  }, []);

  const deleteEntry = async (kind: 'payments' | 'expenses', id: string) => {
    const token = ensureAccessToken();
    await axios.delete(`${API_BASE}/api/v1/${kind}/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (kind === 'payments' && editingPayment?.id === id) setEditingPayment(null);
    if (kind === 'expenses' && editingExpense?.id === id) setEditingExpense(null);
    await loadReport();
  };

  return (
    <AdminShell eyebrow="Finance" title="Бухгалтерия" description="Доходы, расходы и финансовая картина в аккуратном интерфейсе без ощущения перегруженной таблицы.">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-400">Доход</p>
          <p className="mt-3 text-3xl font-semibold text-cyan-300">{formatNokFromOre(report?.revenue ?? 0)}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-400">Расходы</p>
          <p className="mt-3 text-3xl font-semibold text-amber-300">{formatNokFromOre((report?.expenses.salaries ?? 0) + (report?.expenses.materials ?? 0) + (report?.expenses.other ?? 0))}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-400">Чистая прибыль</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">{formatNokFromOre(report?.netProfit ?? 0)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <FinanceEntryForm kind="payments" orders={orders} editingEntry={editingPayment} onSaved={async () => { setEditingPayment(null); await loadReport(); }} onCancel={() => setEditingPayment(null)} />
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <FinanceEntryForm kind="expenses" editingEntry={editingExpense} onSaved={async () => { setEditingExpense(null); await loadReport(); }} onCancel={() => setEditingExpense(null)} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold">Платежи</h2>
          <div className="mt-4 space-y-3 text-sm">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-cyan-300">{formatNokFromOre(payment.amountOre)}</p>
                  <p className="text-slate-400">Заказ: {payment.orderId}</p>
                  <p className="text-slate-500">Месяц: {payment.month}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-2xl border border-white/10 px-3 py-2" onClick={() => setEditingPayment(payment)}>Edit</button>
                  <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-100" onClick={() => deleteEntry('payments', payment.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold">Расходы</h2>
          <div className="mt-4 space-y-3 text-sm">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-amber-300">{formatNokFromOre(expense.amountOre)}</p>
                  <p className="text-slate-400">Категория: {expense.category}</p>
                  <p className="text-slate-500">Месяц: {expense.month}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-2xl border border-white/10 px-3 py-2" onClick={() => setEditingExpense(expense)}>Edit</button>
                  <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-100" onClick={() => deleteEntry('expenses', expense.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

