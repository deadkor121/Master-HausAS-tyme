import dotenv from 'dotenv';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const DEMO_EMAIL = 'admin@masterhaus.no';
const DEMO_PASSWORD = 'Masterhaus123!';

async function main() {
  await prisma.$connect();

  const existingUser = await prisma.user.findFirst({ where: { email: DEMO_EMAIL } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await hash(DEMO_PASSWORD, 10),
        fullName: 'Admin User',
        role: 'admin'
      }
    });
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
      data: [{ orderId: (await prisma.order.findFirstOrThrow()).id, amountOre: 18000000, month: '2026-07' }]
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
    const workers = await prisma.worker.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
    const order = await prisma.order.findFirstOrThrow();

    if (workers.length >= 2) {
      await prisma.timeEntry.createMany({
        data: [
          {
            workerId: workers[0].id,
            orderId: order.id,
            month: '2026-07',
            regularHours: 160,
            overtimeHours: 12
          },
          {
            workerId: workers[1].id,
            orderId: order.id,
            month: '2026-07',
            regularHours: 150,
            overtimeHours: 6
          }
        ]
      });
    }
  }

  const workLogCount = await prisma.workLog.count();
  if (workLogCount === 0) {
    const workers = await prisma.worker.findMany({ orderBy: { createdAt: 'asc' }, take: 1 });

    if (workers.length > 0) {
      await prisma.workLog.createMany({
        data: [
          {
            workerId: workers[0].id,
            workDate: new Date('2026-07-07T00:00:00.000Z'),
            startedAt: new Date('2026-07-07T08:00:00.000Z'),
            endedAt: new Date('2026-07-07T16:30:00.000Z'),
            totalMinutes: 510
          }
        ]
      });
    }
  }

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
