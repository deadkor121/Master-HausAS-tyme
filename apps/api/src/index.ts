import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { compare, hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { google } from 'googleapis';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from './db.js';
import { getWorkerNotificationConfig, sendWorkerNotification } from './notifications.js';

const envPathCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps', 'api', '.env'),
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env')
];

for (const envPath of envPathCandidates) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    break;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email?: string;
        fullName?: string;
        workerId?: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

const DEMO_EMAIL = 'admin@masterhaus.no';
const DEMO_PASSWORD = 'Masterhaus123!';

async function ensureDemoUser() {
  const existingUser = await prisma.user.findFirst({ where: { email: DEMO_EMAIL } });
  if (!existingUser) {
    const { hash } = await import('bcryptjs');
    return prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await hash(DEMO_PASSWORD, 10),
        fullName: 'Admin User',
        role: 'admin'
      }
    });
  }

  const passwordMatches = await compare(DEMO_PASSWORD, existingUser.passwordHash);
  if (!passwordMatches) {
    const { hash } = await import('bcryptjs');
    return prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash: await hash(DEMO_PASSWORD, 10) }
    });
  }

  return existingUser;
}

async function seedData() {
  await ensureDemoUser();

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
  phone: z.string().trim().min(3).max(40).optional(),
  email: z.string().trim().email().optional(),
  photoUrl: z.string().trim().url().optional(),
  bio: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional()
});

const workerRegisterSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  fullName: z.string().trim().min(3),
  role: z.enum(['admin', 'worker']).default('worker'),
  phone: z.string().trim().min(3).max(40).optional(),
  brigadeName: z.string().trim().min(1).optional(),
  photoUrl: z.string().trim().url().optional(),
  skillTags: z.array(z.string().trim().min(1)).optional(),
  bio: z.string().trim().max(500).optional()
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

const workerAdvanceCreateSchema = z.object({
  advanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountOre: z.number().int().positive(),
  note: z.string().trim().max(200).optional()
});

const workSiteCreateSchema = z.object({
  address: z.string().trim().min(5),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(5).max(200).optional()
});

const workSitePingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().max(10000).optional()
});

const workSiteGeolocationStateSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional()
});

const workPhotoReportCreateSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photoUrl: z.string().trim().url().optional(),
  photoUrls: z.array(z.string().trim().url()).min(1).optional(),
  reportType: z.enum(['start', 'end']).optional(),
  note: z.string().trim().max(500).optional()
}).refine((data) => Boolean(data.photoUrl || data.photoUrls?.length), {
  message: 'At least one photo is required',
  path: ['photoUrls']
});

const workShiftReportSchema = z.object({
  photoUrl: z.string().trim().url().optional(),
  photoUrls: z.array(z.string().trim().url()).min(1).optional(),
  note: z.string().trim().min(3).max(500)
}).refine((data) => Boolean(data.photoUrl || data.photoUrls?.length), {
  message: 'At least one photo is required',
  path: ['photoUrls']
});

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  fullName: z.string().trim().min(3),
  role: z.enum(['admin', 'worker']).default('worker')
});

const updateSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMonthKey(date: Date) {
  return toLocalDateKey(date).slice(0, 7);
}

function calculateDistanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);

  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildCloudinarySignature(params: Record<string, string>) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    throw new Error('Cloudinary secret is not configured');
  }

  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
}

function buildWorkLogData(payload: { workDate: string; startedAt: string; endedAt: string }) {
  const startedAt = new Date(`${payload.workDate}T${payload.startedAt}:00`);
  const endedAt = new Date(`${payload.workDate}T${payload.endedAt}:00`);
  const totalMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return null;
  }

  return {
    workDate: new Date(`${payload.workDate}T12:00:00`),
    startedAt,
    endedAt,
    totalMinutes
  };
}

function toFixedHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function requireAdminRole(req: express.Request, res: express.Response) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

function requireOwnWorkerOrAdmin(req: express.Request, res: express.Response, workerId: string) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (req.user.role === 'admin') {
    return true;
  }

  if (req.user.role === 'worker' && req.user.workerId === workerId) {
    return true;
  }

  res.status(403).json({ error: 'Forbidden' });
  return false;
}

async function resolveWorkerIdForUser(fullName: string, role: string) {
  if (role !== 'worker') {
    return undefined;
  }

  const worker = await prisma.worker.findMany();
  const matched = worker.find((entry: { fullName: string }) => entry.fullName.trim().toLowerCase() === fullName.trim().toLowerCase());
  return matched?.id;
}

function signAccessToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string; email?: string; fullName?: string; workerId?: string; type?: string };
    if (decoded.type === 'refresh') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
      fullName: decoded.fullName,
      workerId: decoded.workerId
    };
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

  app.get('/api/v1/notifications/workers/config', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    res.json(await getWorkerNotificationConfig());
  });

  app.post('/api/v1/notifications/workers/test', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const result = await sendWorkerNotification({
      subject: 'Тестовое уведомление для работников MasterHaus',
      text: [
        'Это тестовое уведомление для работников.',
        '',
        'Если вы получили это письмо, значит email-уведомления работают.',
        `Отправлено: ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })}`
      ].join('\n')
    });

    res.json(result);
  });

  app.post('/api/v1/auth/register', async (req, res) => {
    const parsed = workerRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const existing = await prisma.user.findFirst({ where: { email: parsed.data.email } });
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const { hash } = await import('bcryptjs');
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await hash(parsed.data.password, 10),
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        emailNotificationsEnabled: parsed.data.role === 'worker'
      }
    });

    let workerId: string | undefined;
    if (user.role === 'worker') {
      const existingWorkers = await prisma.worker.findMany();
      const matchedWorker = existingWorkers.find((entry: { fullName: string }) => entry.fullName.trim().toLowerCase() === user.fullName.trim().toLowerCase());
      const workerData = {
        fullName: user.fullName,
        role: 'worker',
        hourlyRateOre: 0,
        skillTags: parsed.data.skillTags ?? [],
        brigadeName: parsed.data.brigadeName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        photoUrl: parsed.data.photoUrl,
        bio: parsed.data.bio,
        isActive: true
      };

      const worker = matchedWorker
        ? await prisma.worker.update({
            where: { id: matchedWorker.id },
            data: {
              ...(parsed.data.skillTags ? { skillTags: parsed.data.skillTags } : {}),
              ...(parsed.data.brigadeName !== undefined ? { brigadeName: parsed.data.brigadeName } : {}),
              ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
              ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
              ...(parsed.data.photoUrl !== undefined ? { photoUrl: parsed.data.photoUrl } : {}),
              ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {})
            }
          })
        : await prisma.worker.create({ data: workerData });
      workerId = worker.id;
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email, fullName: user.fullName, workerId });
    const refreshToken = signRefreshToken(user.id);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        workerId,
        emailNotificationsEnabled: user.emailNotificationsEnabled
      }
    });
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    let user = await prisma.user.findFirst({ where: { email } });

    if (!user && email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      user = await ensureDemoUser();
    }

    const isPasswordValid = user
      ? await compare(password, user.passwordHash)
      : false;

    if (!user || !isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const workerId = await resolveWorkerIdForUser(user.fullName, user.role);
    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email, fullName: user.fullName, workerId });
    const refreshToken = signRefreshToken(user.id);

    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName, workerId, emailNotificationsEnabled: user.emailNotificationsEnabled } });
  });

  app.post('/api/v1/auth/refresh', async (req, res) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const decoded = jwt.verify(parsed.data.refreshToken, JWT_SECRET) as { sub?: string; type?: string };
      if (decoded.type !== 'refresh' || !decoded.sub) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      const workerId = await resolveWorkerIdForUser(user.fullName, user.role);
      const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email, fullName: user.fullName, workerId });
      const refreshToken = signRefreshToken(user.id);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          workerId,
          emailNotificationsEnabled: user.emailNotificationsEnabled
        }
      });
    } catch {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  });

  app.get('/api/v1/auth/me', authMiddleware, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const workerId = await resolveWorkerIdForUser(user.fullName, user.role);
    res.json({ user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName, workerId, emailNotificationsEnabled: user.emailNotificationsEnabled } });
  });

  app.put('/api/v1/auth/settings', authMiddleware, async (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { emailNotificationsEnabled: parsed.data.emailNotificationsEnabled }
    });

    const workerId = await resolveWorkerIdForUser(updated.fullName, updated.role);
    res.json({ user: { id: updated.id, email: updated.email, role: updated.role, fullName: updated.fullName, workerId, emailNotificationsEnabled: updated.emailNotificationsEnabled } });
  });

  app.put('/api/v1/auth/change-password', authMiddleware, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const currentPasswordMatches = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(parsed.data.newPassword, 10) }
    });

    res.json({ ok: true });
  });

  app.get('/api/v1/orders', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const orders = await prisma.order.findMany({
      where: query ? {
        OR: [
          { orderNumber: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { status: { contains: query, mode: 'insensitive' } }
        ]
      } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ items: orders });
  });

  app.get('/api/v1/workers', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const workers = await prisma.worker.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items: workers });
  });

  app.get('/api/v1/workers/directory', authMiddleware, async (_req, res) => {
    const workers = await prisma.worker.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items: workers.map((worker: { id: string; fullName: string; role: string }) => ({ id: worker.id, fullName: worker.fullName, role: worker.role })) });
  });

  app.get('/api/v1/workers/geo-status', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const workers = await prisma.worker.findMany({ orderBy: { createdAt: 'desc' } });
    const sites = await prisma.workSite.findMany({
      where: { isActive: true },
      orderBy: { startedAt: 'desc' }
    });
    const reports = await prisma.workPhotoReport.findMany({
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }]
    });

    const items = workers.map((worker: any) => {
      const site = sites.find((entry: any) => entry.workerId === worker.id) ?? null;
      const latestReport = reports.find((entry: any) => entry.workerId === worker.id) ?? null;
      return {
        workerId: worker.id,
        workerName: worker.fullName,
        site,
        latestReport,
        hasLeftSite: Boolean(site?.leftAt)
      };
    });

    res.json({ items });
  });

  app.post('/api/v1/integrations/google-sheets/sync-month', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : toMonthKey(new Date());
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Month must match YYYY-MM format' });
      return;
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!spreadsheetId || !serviceAccountEmail || !serviceAccountPrivateKey) {
      res.status(400).json({ error: 'Google Sheets integration is not configured on server' });
      return;
    }

    const [year, monthNumber] = month.split('-').map(Number);
    const monthStart = new Date(year, monthNumber - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, monthNumber, 1, 0, 0, 0, 0);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const sheetName = typeof req.query.sheetName === 'string' && req.query.sheetName.trim().length > 0
      ? req.query.sheetName.trim()
      : month;

    const [workers, logs] = await Promise.all([
      prisma.worker.findMany({ orderBy: { fullName: 'asc' } }),
      prisma.workLog.findMany({
        where: {
          workDate: {
            gte: monthStart,
            lt: monthEnd
          }
        },
        orderBy: [{ workerId: 'asc' }, { workDate: 'asc' }]
      })
    ]);

    const workerMap = new Map<string, { fullName: string; minutesByDay: number[]; totalMinutes: number }>();
    for (const worker of workers) {
      workerMap.set(worker.id, {
        fullName: worker.fullName,
        minutesByDay: Array.from({ length: 31 }, () => 0),
        totalMinutes: 0
      });
    }

    for (const log of logs) {
      const worker = workerMap.get(log.workerId);
      if (!worker) {
        continue;
      }

      const day = Number(toLocalDateKey(log.workDate).slice(8, 10));
      if (!Number.isFinite(day) || day < 1 || day > 31) {
        continue;
      }

      worker.minutesByDay[day - 1] += log.totalMinutes;
      worker.totalMinutes += log.totalMinutes;
    }

    const header = ['Работник', ...Array.from({ length: 31 }, (_, index) => String(index + 1)), 'Часы', 'Минуты'];
    const values: Array<Array<string | number>> = [header];

    for (const worker of workerMap.values()) {
      const hasAnyMinutes = worker.totalMinutes > 0;
      if (!hasAnyMinutes) {
        continue;
      }

      const dayHours = worker.minutesByDay.map((minutes, dayIndex) => {
        if (dayIndex >= daysInMonth) {
          return '';
        }
        return minutes > 0 ? toFixedHours(minutes) : '';
      });

      values.push([
        worker.fullName,
        ...dayHours,
        toFixedHours(worker.totalMinutes),
        worker.totalMinutes
      ]);
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: serviceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false
      });
      const existingSheetNames = new Set(
        (spreadsheet.data.sheets ?? [])
          .map((entry) => entry.properties?.title)
          .filter((title): title is string => typeof title === 'string')
      );

      if (!existingSheetNames.has(sheetName)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: sheetName } } }]
          }
        });
      }

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${sheetName}'!A:AH`
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync Google Sheets';
      res.status(500).json({ error: message });
      return;
    }

    res.json({ ok: true, month, sheetName, rowsSynced: Math.max(0, values.length - 1) });
  });

  app.post('/api/v1/workers', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
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
        phone: parsed.data.phone,
        email: parsed.data.email,
        photoUrl: parsed.data.photoUrl,
        bio: parsed.data.bio,
        isActive: parsed.data.isActive ?? true
      }
    });

    res.status(201).json(worker);
  });

  app.get('/api/v1/workers/:id', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    res.json(worker);
  });

  app.put('/api/v1/workers/:id', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
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
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
        ...(parsed.data.photoUrl !== undefined ? { photoUrl: parsed.data.photoUrl } : {}),
        ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
      }
    });

    res.json(updated);
  });

  app.delete('/api/v1/workers/:id', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
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

  app.post('/api/v1/uploads/worker-photo/sign', authMiddleware, async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
      res.status(400).json({ error: 'Cloudinary is not configured on the server' });
      return;
    }

    const folder = 'masterhaus/workers';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = buildCloudinarySignature({ folder, timestamp });

    res.json({ cloudName, apiKey, folder, timestamp, signature });
  });

  app.get('/api/v1/workers/:id/work-site', authMiddleware, async (req, res) => {
    const workerId = String(req.params.id);
    if (!requireOwnWorkerOrAdmin(req, res, workerId)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const site = await prisma.workSite.findFirst({
      where: { workerId, isActive: true },
      orderBy: { startedAt: 'desc' }
    });

    res.json({ site });
  });

  app.post('/api/v1/workers/:id/work-site', authMiddleware, async (req, res) => {
    const workerId = String(req.params.id);
    if (!requireOwnWorkerOrAdmin(req, res, workerId)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const parsed = workSiteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    await prisma.workSite.updateMany({
      where: { workerId, isActive: true },
      data: { isActive: false, endedAt: new Date() }
    });

    const site = await prisma.workSite.create({
      data: {
        workerId,
        address: parsed.data.address,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        radiusMeters: parsed.data.radiusMeters ?? 5,
        isActive: true,
        startedAt: new Date(),
        geolocationEnabled: true,
        geolocationDisabledAt: null,
        geolocationDisabledReason: null,
        geolocationResumedAt: null
      }
    });

    res.status(201).json(site);
  });

  app.post('/api/v1/work-sites/:id/geolocation-state', authMiddleware, async (req, res) => {
    const site = await prisma.workSite.findUnique({ where: { id: req.params.id } });
    if (!site) {
      res.status(404).json({ error: 'Work site not found' });
      return;
    }

    if (!requireOwnWorkerOrAdmin(req, res, site.workerId)) {
      return;
    }

    const parsed = workSiteGeolocationStateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (!parsed.data.enabled && !parsed.data.reason?.trim()) {
      res.status(400).json({ error: 'Disable reason is required' });
      return;
    }

    const now = new Date();
    const updatedSite = await prisma.workSite.update({
      where: { id: site.id },
      data: parsed.data.enabled
        ? {
            geolocationEnabled: true,
            geolocationResumedAt: now,
            leftAt: null
          }
        : {
            geolocationEnabled: false,
            geolocationDisabledAt: now,
            geolocationDisabledReason: parsed.data.reason?.trim(),
            leftAt: site.leftAt ?? now
          }
    });

    res.json({ site: updatedSite });
  });

  app.post('/api/v1/work-sites/:id/start-shift', authMiddleware, async (req, res) => {
    const site = await prisma.workSite.findUnique({ where: { id: req.params.id } });
    if (!site) {
      res.status(404).json({ error: 'Work site not found' });
      return;
    }

    if (!requireOwnWorkerOrAdmin(req, res, site.workerId)) {
      return;
    }

    if (!site.geolocationEnabled) {
      res.status(409).json({ error: 'Enable geolocation before starting shift' });
      return;
    }

    if (site.isShiftActive) {
      res.status(409).json({ error: 'Shift is already active' });
      return;
    }

    const parsed = workShiftReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const now = new Date();
    const updatedSite = await prisma.workSite.update({
      where: { id: site.id },
      data: {
        isShiftActive: true,
        shiftStartedAt: now,
        shiftEndedAt: null,
        leftAt: null
      }
    });

    const report = await prisma.workPhotoReport.create({
      data: {
        workerId: site.workerId,
        workSiteId: site.id,
        workDate: new Date(`${toLocalDateKey(now)}T12:00:00`),
        photoUrl: parsed.data.photoUrl ?? parsed.data.photoUrls?.[0] ?? '',
        photoUrls: parsed.data.photoUrls ?? (parsed.data.photoUrl ? [parsed.data.photoUrl] : []),
        reportType: 'start',
        note: parsed.data.note
      }
    });

    res.status(201).json({ site: updatedSite, report });
  });

  app.post('/api/v1/work-sites/:id/finish-shift', authMiddleware, async (req, res) => {
    const site = await prisma.workSite.findUnique({ where: { id: req.params.id } });
    if (!site) {
      res.status(404).json({ error: 'Work site not found' });
      return;
    }

    if (!requireOwnWorkerOrAdmin(req, res, site.workerId)) {
      return;
    }

    if (!site.isShiftActive || !site.shiftStartedAt) {
      res.status(409).json({ error: 'Shift is not active' });
      return;
    }

    const parsed = workShiftReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const finishedAt = new Date();
    const totalMinutes = Math.max(1, Math.round((finishedAt.getTime() - site.shiftStartedAt.getTime()) / 60000));

    const workDateKey = toLocalDateKey(site.shiftStartedAt);
    await prisma.workLog.create({
      data: {
        workerId: site.workerId,
        workDate: new Date(`${workDateKey}T12:00:00`),
        startedAt: site.shiftStartedAt,
        endedAt: finishedAt,
        totalMinutes
      }
    });

    const report = await prisma.workPhotoReport.create({
      data: {
        workerId: site.workerId,
        workSiteId: site.id,
        workDate: new Date(`${workDateKey}T12:00:00`),
        photoUrl: parsed.data.photoUrl ?? parsed.data.photoUrls?.[0] ?? '',
        photoUrls: parsed.data.photoUrls ?? (parsed.data.photoUrl ? [parsed.data.photoUrl] : []),
        reportType: 'end',
        note: parsed.data.note
      }
    });

    const updatedSite = await prisma.workSite.update({
      where: { id: site.id },
      data: {
        isShiftActive: false,
        shiftEndedAt: finishedAt,
        leftAt: finishedAt
      }
    });

    res.status(201).json({ site: updatedSite, report, totalMinutes });
  });

  app.post('/api/v1/work-sites/:id/pings', authMiddleware, async (req, res) => {
    const site = await prisma.workSite.findUnique({ where: { id: req.params.id } });
    if (!site) {
      res.status(404).json({ error: 'Work site not found' });
      return;
    }

    if (!requireOwnWorkerOrAdmin(req, res, site.workerId)) {
      return;
    }

    if (!site.geolocationEnabled) {
      res.status(409).json({ error: 'Geolocation is disabled for this shift', disabledReason: site.geolocationDisabledReason ?? null });
      return;
    }

    const parsed = workSitePingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const distanceMeters = calculateDistanceMeters(
      { latitude: site.latitude, longitude: site.longitude },
      { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
    );
    const isInside = distanceMeters <= site.radiusMeters;

    const ping = await prisma.workSitePing.create({
      data: {
        workSiteId: site.id,
        workerId: site.workerId,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracyMeters: parsed.data.accuracyMeters,
        distanceMeters,
        isInside
      }
    });

    const shouldMarkLeft = !isInside && !site.leftAt;

    await prisma.workSite.update({
      where: { id: site.id },
      data: {
        lastPingAt: new Date(),
        lastPingLatitude: parsed.data.latitude,
        lastPingLongitude: parsed.data.longitude,
        lastDistanceMeters: distanceMeters,
        ...(shouldMarkLeft ? { leftAt: new Date() } : {})
      }
    });

    res.status(201).json({
      ping,
      isInside,
      distanceMeters,
      radiusMeters: site.radiusMeters,
      leftAt: shouldMarkLeft ? new Date() : site.leftAt ?? null
    });
  });

  app.get('/api/v1/workers/:id/photo-reports', authMiddleware, async (req, res) => {
    const workerId = String(req.params.id);
    if (!requireOwnWorkerOrAdmin(req, res, workerId)) {
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const items = await prisma.workPhotoReport.findMany({
      where: { workerId },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }]
    });

    const filteredItems = month
      ? items.filter((entry: any) => toLocalDateKey(entry.workDate).slice(0, 7) === month)
      : items;

    res.json({ items: filteredItems });
  });

  app.post('/api/v1/workers/:id/photo-reports', authMiddleware, async (req, res) => {
    const workerId = String(req.params.id);
    if (!requireOwnWorkerOrAdmin(req, res, workerId)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const parsed = workPhotoReportCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const activeSite = await prisma.workSite.findFirst({
      where: { workerId, isActive: true },
      orderBy: { startedAt: 'desc' }
    });

    const report = await prisma.workPhotoReport.create({
      data: {
        workerId,
        workSiteId: activeSite?.id,
        workDate: new Date(`${parsed.data.workDate}T12:00:00`),
        photoUrl: parsed.data.photoUrl ?? parsed.data.photoUrls?.[0] ?? '',
        photoUrls: parsed.data.photoUrls ?? (parsed.data.photoUrl ? [parsed.data.photoUrl] : []),
        reportType: parsed.data.reportType ?? 'end',
        note: parsed.data.note
      }
    });

    res.status(201).json(report);
  });

  app.get('/api/v1/workers/:id/salary', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : '2026-07';
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const entries = await prisma.timeEntry.findMany({ where: { workerId: worker.id, month } });
    const advances = await prisma.workerAdvance.findMany({
      where: { workerId: worker.id },
      orderBy: [{ advanceDate: 'desc' }, { createdAt: 'desc' }]
    });
    const monthAdvances = advances.filter((advance: { advanceDate: Date }) => toMonthKey(advance.advanceDate) === month);
    const regularHours = entries.reduce((sum: number, entry: { regularHours: number }) => sum + entry.regularHours, 0);
    const overtimeHours = entries.reduce((sum: number, entry: { overtimeHours: number }) => sum + entry.overtimeHours, 0);
    const regularPay = worker.hourlyRateOre * regularHours;
    const overtimePay = Math.round(worker.hourlyRateOre * 0.4 * overtimeHours);
    const totalPayOre = regularPay + overtimePay;
    const advancesPaidOre = monthAdvances.reduce((sum: number, advance: { amountOre: number }) => sum + advance.amountOre, 0);

    res.json({
      workerId: worker.id,
      workerName: worker.fullName,
      month,
      regularHours,
      overtimeHours,
      regularPayOre: regularPay,
      overtimePayOre: overtimePay,
      totalPayOre,
      advancesPaidOre,
      remainingPayOre: totalPayOre - advancesPaidOre,
      advances: monthAdvances
    });
  });

  app.get('/api/v1/workers/:id/work-logs', authMiddleware, async (req, res) => {
    const workerId = String(req.params.id);
    if (!requireOwnWorkerOrAdmin(req, res, workerId)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const items = await prisma.workLog.findMany({ where: { workerId: worker.id } });
    const filteredItems = month
      ? items.filter((item: { workDate: Date }) => toLocalDateKey(item.workDate).slice(0, 7) === month)
      : items;

    const itemsWithEarnings = filteredItems.map((item: { totalMinutes: number; workDate: Date }) => {
      const earnedOre = Math.round((worker.hourlyRateOre * item.totalMinutes) / 60);
      return {
        ...item,
        earnedOre,
        workDateKey: toLocalDateKey(item.workDate)
      };
    });

    const totalMinutes = itemsWithEarnings.reduce((sum: number, item: { totalMinutes: number }) => sum + item.totalMinutes, 0);
    const totalEarnedOre = itemsWithEarnings.reduce((sum: number, item: { earnedOre: number }) => sum + item.earnedOre, 0);
    const earningsByDate = itemsWithEarnings.reduce((acc: Record<string, { minutes: number; earnedOre: number }>, item: { workDateKey: string; totalMinutes: number; earnedOre: number }) => {
      const existing = acc[item.workDateKey] ?? { minutes: 0, earnedOre: 0 };
      acc[item.workDateKey] = {
        minutes: existing.minutes + item.totalMinutes,
        earnedOre: existing.earnedOre + item.earnedOre
      };
      return acc;
    }, {});

    res.json({
      items: itemsWithEarnings,
      summary: {
        workerId: worker.id,
        workerName: worker.fullName,
        month,
        hourlyRateOre: worker.hourlyRateOre,
        totalMinutes,
        totalEarnedOre,
        earningsByDate
      }
    });
  });

  app.post('/api/v1/workers/:id/work-logs', authMiddleware, async (req, res) => {
    const workerId = String(req.params.id);
    if (!requireOwnWorkerOrAdmin(req, res, workerId)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
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

    if (!requireOwnWorkerOrAdmin(req, res, existing.workerId)) {
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

    if (!requireOwnWorkerOrAdmin(req, res, existing.workerId)) {
      return;
    }

    await prisma.workLog.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/v1/workers/:id/advances', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const items = await prisma.workerAdvance.findMany({
      where: { workerId: worker.id },
      orderBy: [{ advanceDate: 'desc' }, { createdAt: 'desc' }]
    });

    const filteredItems = month
      ? items.filter((item: { advanceDate: Date }) => toMonthKey(item.advanceDate) === month)
      : items;

    res.json({ items: filteredItems });
  });

  app.post('/api/v1/workers/:id/advances', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const parsed = workerAdvanceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const created = await prisma.workerAdvance.create({
      data: {
        workerId: worker.id,
        amountOre: parsed.data.amountOre,
        advanceDate: new Date(`${parsed.data.advanceDate}T12:00:00`),
        note: parsed.data.note
      }
    });

    res.status(201).json(created);
  });

  app.put('/api/v1/worker-advances/:id', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const existing = await prisma.workerAdvance.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Advance not found' });
      return;
    }

    const parsed = workerAdvanceCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const updated = await prisma.workerAdvance.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.amountOre !== undefined ? { amountOre: parsed.data.amountOre } : {}),
        ...(parsed.data.advanceDate ? { advanceDate: new Date(`${parsed.data.advanceDate}T12:00:00`) } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {})
      }
    });

    res.json(updated);
  });

  app.delete('/api/v1/worker-advances/:id', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

    const existing = await prisma.workerAdvance.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Advance not found' });
      return;
    }

    await prisma.workerAdvance.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/v1/workers/:id/time-entries', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

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
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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

  app.get('/api/v1/dashboard/live-overview', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
      return;
    }

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
    if (!requireAdminRole(req, res)) {
      return;
    }

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
    if (!requireAdminRole(req, res)) {
      return;
    }

    const month = req.query.month as string | undefined;
    const items = await prisma.payment.findMany({ where: month ? { month } : undefined });
    res.json({ items });
  });

  app.post('/api/v1/payments', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
      return;
    }

    const month = req.query.month as string | undefined;
    const items = await prisma.expense.findMany({ where: month ? { month } : undefined });
    res.json({ items });
  });

  app.post('/api/v1/expenses', authMiddleware, async (req, res) => {
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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
    if (!requireAdminRole(req, res)) {
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

      const notificationResult = await sendWorkerNotification({
        subject: `Новый заказ ${nextOrder.orderNumber}`,
        text: [
          'Создан новый заказ для работников MasterHaus.',
          '',
          `Номер заказа: ${nextOrder.orderNumber}`,
          `Название: ${nextOrder.title}`,
          `Статус: ${nextOrder.status}`,
          `Дедлайн: ${parsed.data.deadlineDate}`,
          `Бюджет: ${(nextOrder.budgetTotalOre / 100).toFixed(2)} NOK`
        ].join('\n')
      });

      res.status(201).json({
        ...nextOrder,
        workerNotification: notificationResult
      });
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
    if (!requireAdminRole(req, res)) {
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

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
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
