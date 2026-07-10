import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ensureDemoAccessToken } from '../lib/auth';
import FinanceEntryForm from '../components/FinanceEntryForm';
import { formatNokFromOre } from '../lib/currency';

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
    const token = await ensureDemoAccessToken();
    const [reportResponse, paymentsResponse, expensesResponse, ordersResponse] = await Promise.all([
      axios.get('/api/v1/finance/monthly-report?month=2026-07', {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get('/api/v1/payments?month=2026-07', {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get('/api/v1/expenses?month=2026-07', {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get('/api/v1/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
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
    const token = await ensureDemoAccessToken();
    await axios.delete(`/api/v1/${kind}/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (kind === 'payments' && editingPayment?.id === id) {
      setEditingPayment(null);
    }
    if (kind === 'expenses' && editingExpense?.id === id) {
      setEditingExpense(null);
    }
    await loadReport();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Accounting & Finance</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Review monthly revenue, expenses and net profit for the current reporting period.
            </p>
          </div>
          <Link to="/" className="rounded border border-slate-700 px-3 py-2 text-sm">Back home</Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <FinanceEntryForm
            kind="payments"
            orders={orders}
            editingEntry={editingPayment}
            onSaved={async () => {
              setEditingPayment(null);
              await loadReport();
            }}
            onCancel={() => setEditingPayment(null)}
          />
          <FinanceEntryForm
            kind="expenses"
            editingEntry={editingExpense}
            onSaved={async () => {
              setEditingExpense(null);
              await loadReport();
            }}
            onCancel={() => setEditingExpense(null)}
          />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">Доход</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-300">{formatNokFromOre(report?.revenue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">Расходы</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">{formatNokFromOre((report?.expenses.salaries ?? 0) + (report?.expenses.materials ?? 0) + (report?.expenses.other ?? 0))}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">Чистая прибыль</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatNokFromOre(report?.netProfit ?? 0)}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Платежи</h2>
            <div className="mt-4 space-y-3 text-sm">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <p className="font-medium text-cyan-300">{formatNokFromOre(payment.amountOre)}</p>
                    <p className="text-slate-400">Заказ: {payment.orderId}</p>
                    <p className="text-slate-500">Месяц: {payment.month}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded border border-slate-700 px-3 py-1.5" onClick={() => setEditingPayment(payment)}>
                      Edit
                    </button>
                    <button className="rounded border border-rose-700 px-3 py-1.5 text-rose-200" onClick={() => deleteEntry('payments', payment.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Расходы</h2>
            <div className="mt-4 space-y-3 text-sm">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <p className="font-medium text-amber-300">{formatNokFromOre(expense.amountOre)}</p>
                    <p className="text-slate-400">Категория: {expense.category}</p>
                    <p className="text-slate-500">Месяц: {expense.month}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded border border-slate-700 px-3 py-1.5" onClick={() => setEditingExpense(expense)}>
                      Edit
                    </button>
                    <button className="rounded border border-rose-700 px-3 py-1.5 text-rose-200" onClick={() => deleteEntry('expenses', expense.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
