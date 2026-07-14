import { hashSync } from 'bcryptjs';

const DEMO_PASSWORD_HASH = hashSync('Masterhaus123!', 10);
const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
const isLikelyPlaceholderDbUrl = (
  databaseUrl.length === 0
  || databaseUrl.includes('db.example.com')
  || databaseUrl.includes('user:pass@')
  || databaseUrl.includes('localhost')
  || databaseUrl.includes('127.0.0.1')
);
const allowFallbackDb = process.env.ALLOW_FALLBACK_DB === 'true'
  || (process.env.VERCEL === '1' && isLikelyPlaceholderDbUrl);

if (process.env.VERCEL === '1' && isLikelyPlaceholderDbUrl) {
  console.warn('DATABASE_URL looks local/placeholder on Vercel. Using fallback in-memory database.');
}

type PrismaLikeClient = {
  user: {
    findFirst: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  order: {
    count: () => Promise<number>;
    createMany: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findFirst: (args?: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  worker: {
    count: () => Promise<number>;
    createMany: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  payment: {
    count: () => Promise<number>;
    createMany: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  expense: {
    count: () => Promise<number>;
    createMany: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  timeEntry: {
    count: () => Promise<number>;
    createMany: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  workLog: {
    count: () => Promise<number>;
    createMany: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
};

function createFallbackPrisma(): PrismaLikeClient {
  const users: any[] = [
    {
      id: 'user-admin',
      email: 'admin@masterhaus.no',
      passwordHash: DEMO_PASSWORD_HASH,
      fullName: 'Admin User',
      role: 'admin',
      emailNotificationsEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  const orders: any[] = [
    {
      id: 'order-1',
      orderNumber: 'MH-2026-0042',
      title: 'Renovation of office space',
      status: 'in_progress',
      budgetTotalOre: 12500000,
      deadlineDate: new Date('2026-08-31'),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  const workers: any[] = [
    {
      id: 'worker-1',
      fullName: 'Ole Hansen',
      role: 'carpenter',
      hourlyRateOre: 24500,
      skillTags: ['carpentry', 'renovation'],
      brigadeName: 'Brigade A',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'worker-2',
      fullName: 'Maria Løken',
      role: 'electrician',
      hourlyRateOre: 28500,
      skillTags: ['electrical', 'maintenance'],
      brigadeName: 'Brigade B',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  const payments: any[] = [{ id: 'payment-1', orderId: 'order-1', amountOre: 18000000, month: '2026-07', createdAt: new Date() }];
  const expenses: any[] = [
    { id: 'expense-1', category: 'material', amountOre: 4200000, month: '2026-07', createdAt: new Date() },
    { id: 'expense-2', category: 'transport', amountOre: 860000, month: '2026-07', createdAt: new Date() }
  ];
  const timeEntries: any[] = [
    {
      id: 'time-entry-1',
      workerId: 'worker-1',
      orderId: 'order-1',
      month: '2026-07',
      regularHours: 160,
      overtimeHours: 12,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'time-entry-2',
      workerId: 'worker-2',
      orderId: 'order-1',
      month: '2026-07',
      regularHours: 150,
      overtimeHours: 6,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  const workLogs: any[] = [
    {
      id: 'work-log-1',
      workerId: 'worker-1',
      workDate: new Date('2026-07-07T00:00:00.000Z'),
      startedAt: new Date('2026-07-07T08:00:00.000Z'),
      endedAt: new Date('2026-07-07T16:30:00.000Z'),
      totalMinutes: 510,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  return {
    user: {
      findFirst: async ({ where }: any) => users.find((user) => user.email === where?.email) ?? null,
      findMany: async ({ where }: any = {}) => users.filter((user) => {
        const roleMatches = where?.role ? user.role === where.role : true;
        const emailNotificationsMatches = typeof where?.emailNotificationsEnabled === 'boolean'
          ? user.emailNotificationsEnabled === where.emailNotificationsEnabled
          : true;
        return roleMatches && emailNotificationsMatches;
      }),
      findUnique: async ({ where }: any) => users.find((user) => user.id === where?.id || user.email === where?.email) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `user-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        users.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = users.findIndex((user) => user.id === where.id || user.email === where.email);
        if (index === -1) {
          throw new Error('User not found');
        }
        const updated = { ...users[index], ...data, updatedAt: new Date() };
        users[index] = updated;
        return updated;
      }
    },
    order: {
      count: async () => orders.length,
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          orders.push({ id: `order-${Date.now()}-${orders.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...entry });
        }
        return { count: data.length };
      },
      findMany: async ({ orderBy }: any = {}) => {
        const items = [...orders];
        if (orderBy?.createdAt === 'desc') {
          return items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        }
        return items;
      },
      findFirst: async ({ orderBy }: any = {}) => {
        const items = [...orders];
        if (orderBy?.createdAt === 'asc') {
          return items.sort((a, b) => Number(a.createdAt) - Number(b.createdAt))[0] ?? null;
        }
        if (orderBy?.createdAt === 'desc') {
          return items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0] ?? null;
        }
        return items[0] ?? null;
      },
      findUnique: async ({ where }: any) => orders.find((order) => order.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `order-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        orders.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = orders.findIndex((order) => order.id === where.id);
        if (index === -1) {
          throw new Error('Order not found');
        }
        const updated = { ...orders[index], ...data, updatedAt: new Date() };
        orders[index] = updated;
        return updated;
      }
    },
    worker: {
      count: async () => workers.length,
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          workers.push({ id: `worker-${Date.now()}-${workers.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...entry });
        }
        return { count: data.length };
      },
      findMany: async ({ orderBy }: any = {}) => {
        const items = [...workers];
        if (orderBy?.createdAt === 'desc') {
          return items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        }
        return items;
      },
      findUnique: async ({ where }: any) => workers.find((worker) => worker.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `worker-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        workers.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = workers.findIndex((worker) => worker.id === where.id);
        if (index === -1) {
          throw new Error('Worker not found');
        }
        const updated = { ...workers[index], ...data, updatedAt: new Date() };
        workers[index] = updated;
        return updated;
      },
      delete: async ({ where }: any) => {
        const index = workers.findIndex((worker) => worker.id === where.id);
        if (index === -1) {
          throw new Error('Worker not found');
        }
        const [deleted] = workers.splice(index, 1);
        return deleted;
      }
    },
    payment: {
      count: async () => payments.length,
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          payments.push({ id: `payment-${Date.now()}-${payments.length + 1}`, createdAt: new Date(), ...entry });
        }
        return { count: data.length };
      },
      findMany: async ({ where }: any = {}) => where?.month ? payments.filter((payment) => payment.month === where.month) : [...payments],
      findUnique: async ({ where }: any) => payments.find((payment) => payment.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `payment-${Date.now()}`, createdAt: new Date(), ...data };
        payments.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = payments.findIndex((payment) => payment.id === where.id);
        if (index === -1) {
          throw new Error('Payment not found');
        }
        const updated = { ...payments[index], ...data };
        payments[index] = updated;
        return updated;
      },
      delete: async ({ where }: any) => {
        const index = payments.findIndex((payment) => payment.id === where.id);
        if (index === -1) {
          throw new Error('Payment not found');
        }
        const [deleted] = payments.splice(index, 1);
        return deleted;
      }
    },
    expense: {
      count: async () => expenses.length,
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          expenses.push({ id: `expense-${Date.now()}-${expenses.length + 1}`, createdAt: new Date(), ...entry });
        }
        return { count: data.length };
      },
      findMany: async ({ where }: any = {}) => where?.month ? expenses.filter((expense) => expense.month === where.month) : [...expenses],
      findUnique: async ({ where }: any) => expenses.find((expense) => expense.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `expense-${Date.now()}`, createdAt: new Date(), ...data };
        expenses.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = expenses.findIndex((expense) => expense.id === where.id);
        if (index === -1) {
          throw new Error('Expense not found');
        }
        const updated = { ...expenses[index], ...data };
        expenses[index] = updated;
        return updated;
      },
      delete: async ({ where }: any) => {
        const index = expenses.findIndex((expense) => expense.id === where.id);
        if (index === -1) {
          throw new Error('Expense not found');
        }
        const [deleted] = expenses.splice(index, 1);
        return deleted;
      }
    },
    timeEntry: {
      count: async () => timeEntries.length,
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          timeEntries.push({ id: `time-entry-${Date.now()}-${timeEntries.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...entry });
        }
        return { count: data.length };
      },
      findMany: async ({ where }: any = {}) => timeEntries.filter((entry) => {
        const monthMatches = where?.month ? entry.month === where.month : true;
        const workerMatches = where?.workerId ? entry.workerId === where.workerId : true;
        const orderMatches = where?.orderId ? entry.orderId === where.orderId : true;
        return monthMatches && workerMatches && orderMatches;
      }),
      findUnique: async ({ where }: any) => timeEntries.find((entry) => entry.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `time-entry-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        timeEntries.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = timeEntries.findIndex((entry) => entry.id === where.id);
        if (index === -1) {
          throw new Error('Time entry not found');
        }
        const updated = { ...timeEntries[index], ...data, updatedAt: new Date() };
        timeEntries[index] = updated;
        return updated;
      },
      delete: async ({ where }: any) => {
        const index = timeEntries.findIndex((entry) => entry.id === where.id);
        if (index === -1) {
          throw new Error('Time entry not found');
        }
        const [deleted] = timeEntries.splice(index, 1);
        return deleted;
      }
    },
    workLog: {
      count: async () => workLogs.length,
      createMany: async ({ data }: any) => {
        for (const entry of data) {
          workLogs.push({ id: `work-log-${Date.now()}-${workLogs.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...entry });
        }
        return { count: data.length };
      },
      findMany: async ({ where }: any = {}) => workLogs.filter((entry) => {
        const workerMatches = where?.workerId ? entry.workerId === where.workerId : true;
        return workerMatches;
      }),
      findUnique: async ({ where }: any) => workLogs.find((entry) => entry.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const item = { id: `work-log-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        workLogs.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const index = workLogs.findIndex((entry) => entry.id === where.id);
        if (index === -1) {
          throw new Error('Work log not found');
        }
        const updated = { ...workLogs[index], ...data, updatedAt: new Date() };
        workLogs[index] = updated;
        return updated;
      },
      delete: async ({ where }: any) => {
        const index = workLogs.findIndex((entry) => entry.id === where.id);
        if (index === -1) {
          throw new Error('Work log not found');
        }
        const [deleted] = workLogs.splice(index, 1);
        return deleted;
      }
    }
  };
}

let prismaInstance: PrismaLikeClient;

try {
  const { PrismaClient } = await import('@prisma/client');
  const candidate = new PrismaClient() as unknown as Partial<PrismaLikeClient>;
  if (!candidate.timeEntry || !candidate.worker || !candidate.payment || !candidate.expense) {
    if (allowFallbackDb) {
      prismaInstance = createFallbackPrisma();
    } else {
      throw new Error('Generated Prisma client is out of date. Run prisma generate against apps/api/prisma/schema.prisma.');
    }
  } else {
    prismaInstance = candidate as PrismaLikeClient;
  }
} catch {
  if (allowFallbackDb) {
    prismaInstance = createFallbackPrisma();
  } else {
    throw new Error('Prisma/PostgreSQL is required for the main application mode. Set ALLOW_FALLBACK_DB=true only for emergency local fallback.');
  }
}

export const prisma = prismaInstance;
