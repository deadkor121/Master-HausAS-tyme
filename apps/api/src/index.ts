import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { prisma } from './db.js';

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

const DEMO_EMAIL = 'admin@masterhaus.no';
const DEMO_PASSWORD = 'Masterhaus123!';

async function seedData() {
  const existingUser = await prisma.user.findFirst({ where: { email: DEMO_EMAIL } });
  if (!existingUser) {
    const { hash } = await import('bcryptjs');
    await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await hash(DEMO_PASSWORD, 10),
        fullName: 'Admin User',
        role: 'admin'
      }
    });
  } else {
    const passwordMatches = await compare(DEMO_PASSWORD, existingUser.passwordHash);
    if (!passwordMatches) {
      const { hash } = await import('bcryptjs');
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash: await hash(DEMO_PASSWORD, 10) }
      });
    }
  }

  const orderCount = await prisma.order.count();
  if (orderCount === 0) {
    await prisma.order.createMany({
      data: [
        {
          orderNumber: 'MH-2026-0042',
          title: 'Renovation of office space',
          status: 'in_progress',
          budgetTotalOre: 12500000,
          deadlineDate: new Date('2026-08-31')
        }
      ]
    });
  }

  const workerCount = await prisma.worker.count();
  if (workerCount === 0) {
    await prisma.worker.createMany({
      data: [
        {
          fullName: 'Ole Hansen',
          role: 'carpenter',
          hourlyRateOre: 24500,
          skillTags: ['carpentry', 'renovation'],
          brigadeName: 'Brigade A',
          isActive: true
        },
        {
          fullName: 'Maria Løken',
          role: 'electrician',
          hourlyRateOre: 28500,
          skillTags: ['electrical', 'maintenance'],
          brigadeName: 'Brigade B',
          isActive: true
        }
      ]
    });
  }

  const paymentCount = await prisma.payment.count();
  if (paymentCount === 0) {
    await prisma.payment.createMany({
      data: [{ orderId: 'order-1', amountOre: 18000000, month: '2026-07' }]
    });
  }

  const expenseCount = await prisma.expense.count();
  if (expenseCount === 0) {
    await prisma.expense.createMany({
      data: [
        { category: 'material', amountOre: 4200000, month: '2026-07' },
        { category: 'transport', amountOre: 860000, month: '2026-07' }
      ]
    });
  }

  const timeEntryCount = await prisma.timeEntry.count();
  if (timeEntryCount === 0) {
    const seededWorkers = await prisma.worker.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
    const seededOrder = await prisma.order.findFirst({ orderBy: { createdAt: 'asc' } });

    if (seededOrder && seededWorkers.length >= 2) {
      await prisma.timeEntry.createMany({
        data: [
          {
            workerId: seededWorkers[0].id,
            orderId: seededOrder.id,
            month: '2026-07',
            regularHours: 160,
            overtimeHours: 12
          },
          {
            workerId: seededWorkers[1].id,
            orderId: seededOrder.id,
            month: '2026-07',
            regularHours: 150,
            overtimeHours: 6
          }
        ]
      });
    }
  }
}

const shouldSeedData = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';

if (shouldSeedData) {
  try {
    await seedData();
  } catch {
    // ignore seeding errors in local dev/test environments when no database is configured
  }
}

const orderCreateSchema = z.object({
  orderNumber: z.string().trim().min(3),
  title: z.string().trim().min(3),
  status: z.enum(['draft', 'planned', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  budgetTotalOre: z.number().int().nonnegative(),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const workerCreateSchema = z.object({
  fullName: z.string().trim().min(3),
  role: z.string().trim().min(2),
  hourlyRateOre: z.number().int().nonnegative(),
  skillTags: z.array(z.string().trim().min(1)).default([]),
  brigadeName: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional()
});

const paymentCreateSchema = z.object({
  orderId: z.string().trim().min(1),
  amountOre: z.number().int().nonnegative(),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

const expenseCreateSchema = z.object({
  category: z.string().trim().min(2),
  amountOre: z.number().int().nonnegative(),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

const timeEntryCreateSchema = z.object({
  orderId: z.string().trim().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  regularHours: z.number().int().nonnegative(),
  overtimeHours: z.number().int().nonnegative()
});

const workLogCreateSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.string().regex(/^\d{2}:\d{2}$/),
  endedAt: z.string().regex(/^\d{2}:\d{2}$/)
});

function buildWorkLogData(payload: { workDate: string; startedAt: string; endedAt: string }) {
  const startedAt = new Date(`${payload.workDate}T${payload.startedAt}:00`);
  const endedAt = new Date(`${payload.workDate}T${payload.endedAt}:00`);
  const totalMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return null;
  }

  return {
    workDate: new Date(`${payload.workDate}T00:00:00`),
    startedAt,
    endedAt,
    totalMinutes
  };
}

function requireManagerRole(req: express.Request, res: express.Response) {
  if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as object)) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    next(err);
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      service: 'masterhaus-api',
      status: 'ok',
      health: '/api/v1/health'
    });
  });

  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'masterhaus-api' });
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user || !(await compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signToken({ sub: user.id, role: user.role });
    const refreshToken = signToken({ sub: user.id, type: 'refresh' });

    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } });
  });

  app.get('/api/v1/orders', authMiddleware, async (_req, res) => {
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items: orders });
  });

  app.get('/api/v1/workers', authMiddleware, async (_req, res) => {
    const workers = await prisma.worker.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items: workers });
  });

  app.post('/api/v1/workers', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const parsed = workerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const worker = await prisma.worker.create({
      data: {
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        hourlyRateOre: parsed.data.hourlyRateOre,
        skillTags: parsed.data.skillTags,
        brigadeName: parsed.data.brigadeName,
        isActive: parsed.data.isActive ?? true
      }
    });

    res.status(201).json(worker);
  });

  app.get('/api/v1/workers/:id', authMiddleware, async (req, res) => {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    res.json(worker);
  });

  app.put('/api/v1/workers/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const parsed = workerCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const updated = await prisma.worker.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.fullName ? { fullName: parsed.data.fullName } : {}),
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.hourlyRateOre !== undefined ? { hourlyRateOre: parsed.data.hourlyRateOre } : {}),
        ...(parsed.data.skillTags ? { skillTags: parsed.data.skillTags } : {}),
        ...(parsed.data.brigadeName !== undefined ? { brigadeName: parsed.data.brigadeName } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
      }
    });

    res.json(updated);
  });

  app.delete('/api/v1/workers/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    await prisma.worker.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/v1/workers/:id/salary', authMiddleware, async (req, res) => {
    const month = typeof req.query.month === 'string' ? req.query.month : '2026-07';
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const entries = await prisma.timeEntry.findMany({ where: { workerId: worker.id, month } });
    const regularHours = entries.reduce((sum: number, entry: { regularHours: number }) => sum + entry.regularHours, 0);
    const overtimeHours = entries.reduce((sum: number, entry: { overtimeHours: number }) => sum + entry.overtimeHours, 0);
    const regularPay = worker.hourlyRateOre * regularHours;
    const overtimePay = Math.round(worker.hourlyRateOre * 0.4 * overtimeHours);

    res.json({
      workerId: worker.id,
      workerName: worker.fullName,
      month,
      regularHours,
      overtimeHours,
      regularPayOre: regularPay,
      overtimePayOre: overtimePay,
      totalPayOre: regularPay + overtimePay
    });
  });

  app.get('/api/v1/workers/:id/work-logs', authMiddleware, async (req, res) => {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const items = await prisma.workLog.findMany({ where: { workerId: worker.id } });
    const filteredItems = month
      ? items.filter((item: { workDate: Date }) => item.workDate.toISOString().slice(0, 7) === month)
      : items;

    res.json({ items: filteredItems });
  });

  app.post('/api/v1/workers/:id/work-logs', authMiddleware, async (req, res) => {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const parsed = workLogCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const workLogData = buildWorkLogData(parsed.data);
    if (!workLogData) {
      res.status(400).json({ error: 'End time must be later than start time' });
      return;
    }

    const created = await prisma.workLog.create({
      data: {
        workerId: worker.id,
        ...workLogData
      }
    });

    res.status(201).json(created);
  });

  app.put('/api/v1/work-logs/:id', authMiddleware, async (req, res) => {
    const existing = await prisma.workLog.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Work log not found' });
      return;
    }

    const parsed = workLogCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const workLogData = buildWorkLogData(parsed.data);
    if (!workLogData) {
      res.status(400).json({ error: 'End time must be later than start time' });
      return;
    }

    const updated = await prisma.workLog.update({
      where: { id: req.params.id },
      data: workLogData
    });

    res.json(updated);
  });

  app.delete('/api/v1/work-logs/:id', authMiddleware, async (req, res) => {
    const existing = await prisma.workLog.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Work log not found' });
      return;
    }

    await prisma.workLog.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/v1/workers/:id/time-entries', authMiddleware, async (req, res) => {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const items = await prisma.timeEntry.findMany({
      where: {
        workerId: worker.id,
        ...(month ? { month } : {})
      }
    });

    res.json({ items });
  });

  app.post('/api/v1/workers/:id/time-entries', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const parsed = timeEntryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const created = await prisma.timeEntry.create({
      data: {
        workerId: worker.id,
        orderId: parsed.data.orderId,
        month: parsed.data.month,
        regularHours: parsed.data.regularHours,
        overtimeHours: parsed.data.overtimeHours
      }
    });

    res.status(201).json(created);
  });

  app.put('/api/v1/time-entries/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    const parsed = timeEntryCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (parsed.data.orderId) {
      const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
    }

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.orderId ? { orderId: parsed.data.orderId } : {}),
        ...(parsed.data.month ? { month: parsed.data.month } : {}),
        ...(parsed.data.regularHours !== undefined ? { regularHours: parsed.data.regularHours } : {}),
        ...(parsed.data.overtimeHours !== undefined ? { overtimeHours: parsed.data.overtimeHours } : {})
      }
    });

    res.json(updated);
  });

  app.delete('/api/v1/time-entries/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    await prisma.timeEntry.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/v1/dashboard/live-overview', authMiddleware, async (_req, res) => {
    const activeOrders = await prisma.order.findMany({
      where: { status: { in: ['in_progress', 'planned'] } },
      orderBy: { createdAt: 'desc' }
    });
    const workers = await prisma.worker.findMany({ take: 2 });
    const alerts = activeOrders.map((order: { id: string; orderNumber: string; deadlineDate: Date; title: string }) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      message: `Deadline ${order.deadlineDate.toISOString().slice(0, 10)} is approaching for ${order.title}`
    }));

    res.json({
      orders: activeOrders.map((order: { id: string; orderNumber: string; status: string; title: string; deadlineDate: Date; budgetTotalOre: number; createdAt: Date }) => ({
        ...order,
        deadlineDate: order.deadlineDate.toISOString().slice(0, 10),
        assignedWorkers: workers.map((worker: { fullName: string }) => worker.fullName)
      })),
      alerts
    });
  });

  app.get('/api/v1/finance/monthly-report', authMiddleware, async (req, res) => {
    const month = req.query.month as string | undefined;
    const reportMonth = month ?? '2026-07';
    const monthPayments = await prisma.payment.findMany({ where: { month: reportMonth } });
    const monthExpenses = await prisma.expense.findMany({ where: { month: reportMonth } });
    const monthTimeEntries = await prisma.timeEntry.findMany({ where: { month: reportMonth } });
    const involvedWorkerIds = [...new Set(monthTimeEntries.map((entry: { workerId: string }) => entry.workerId))];
    const workers = await Promise.all(involvedWorkerIds.map((workerId) => prisma.worker.findUnique({ where: { id: workerId } })));

    const revenue = monthPayments.reduce((sum: number, payment: { amountOre: number }) => sum + payment.amountOre, 0);
    const workerRateMap = new Map(workers.filter(Boolean).map((worker: any) => [worker.id, worker.hourlyRateOre]));
    const salaries = monthTimeEntries.reduce((sum: number, entry: { workerId: string; regularHours: number; overtimeHours: number }) => {
      const hourlyRateOre = workerRateMap.get(entry.workerId) ?? 0;
      return sum + (hourlyRateOre * entry.regularHours) + Math.round(hourlyRateOre * 0.4 * entry.overtimeHours);
    }, 0);
    const materials = monthExpenses.filter((expense: { category: string; amountOre: number }) => expense.category === 'material').reduce((sum: number, expense: { amountOre: number }) => sum + expense.amountOre, 0);
    const other = monthExpenses.filter((expense: { category: string; amountOre: number }) => expense.category !== 'material').reduce((sum: number, expense: { amountOre: number }) => sum + expense.amountOre, 0);
    const netProfit = revenue - salaries - materials - other;

    res.json({
      month: reportMonth,
      revenue,
      expenses: { salaries, materials, other },
      netProfit
    });
  });

  app.get('/api/v1/payments', authMiddleware, async (req, res) => {
    const month = req.query.month as string | undefined;
    const items = await prisma.payment.findMany({ where: month ? { month } : undefined });
    res.json({ items });
  });

  app.post('/api/v1/payments', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const parsed = paymentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const payment = await prisma.payment.create({ data: parsed.data });
    res.status(201).json(payment);
  });

  app.put('/api/v1/payments/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const parsed = paymentCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (parsed.data.orderId) {
      const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
    }

    const updated = await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.orderId ? { orderId: parsed.data.orderId } : {}),
        ...(parsed.data.amountOre !== undefined ? { amountOre: parsed.data.amountOre } : {}),
        ...(parsed.data.month ? { month: parsed.data.month } : {})
      }
    });

    res.json(updated);
  });

  app.delete('/api/v1/payments/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    await prisma.payment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/v1/expenses', authMiddleware, async (req, res) => {
    const month = req.query.month as string | undefined;
    const items = await prisma.expense.findMany({ where: month ? { month } : undefined });
    res.json({ items });
  });

  app.post('/api/v1/expenses', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const parsed = expenseCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const expense = await prisma.expense.create({ data: parsed.data });
    res.status(201).json(expense);
  });

  app.put('/api/v1/expenses/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const parsed = expenseCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.category ? { category: parsed.data.category } : {}),
        ...(parsed.data.amountOre !== undefined ? { amountOre: parsed.data.amountOre } : {}),
        ...(parsed.data.month ? { month: parsed.data.month } : {})
      }
    });

    res.json(updated);
  });

  app.delete('/api/v1/expenses/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.post('/api/v1/orders', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const parsed = orderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const nextOrder = await prisma.order.create({
        data: {
          orderNumber: parsed.data.orderNumber,
          title: parsed.data.title,
          status: parsed.data.status ?? 'planned',
          budgetTotalOre: parsed.data.budgetTotalOre,
          deadlineDate: new Date(parsed.data.deadlineDate)
        }
      });

      res.status(201).json(nextOrder);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        res.status(409).json({ error: 'Order number already exists' });
        return;
      }

      throw error;
    }
  });

  app.get('/api/v1/orders/:id', authMiddleware, async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
  });

  app.put('/api/v1/orders/:id', authMiddleware, async (req, res) => {
    if (!requireManagerRole(req, res)) {
      return;
    }

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const parsed = orderCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.orderNumber ? { orderNumber: parsed.data.orderNumber } : {}),
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.budgetTotalOre !== undefined ? { budgetTotalOre: parsed.data.budgetTotalOre } : {}),
        ...(parsed.data.deadlineDate ? { deadlineDate: new Date(parsed.data.deadlineDate) } : {})
      }
    });

    res.json(updated);
  });

  return app;
}

const isDirectExecution = (() => {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(process.argv[1]).href;
})();

// create the app instance for both direct execution and serverless exposure
const app = createApp();

if (isDirectExecution) {
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

// Export a default handler function for Vercel/Serverless (explicit function expected)
export default function handler(req: express.Request, res: express.Response) {
  return app(req, res);
}
