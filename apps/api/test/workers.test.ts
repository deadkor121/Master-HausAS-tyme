import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('workers endpoint returns worker list for authenticated user', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const response = await request(app)
    .get('/api/v1/workers')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.items));
  assert.ok(response.body.items.length > 0);

  const salaryResponse = await request(app)
    .get(`/api/v1/workers/${response.body.items[0].id}/salary?month=2026-07`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(salaryResponse.status, 200);
  assert.ok(salaryResponse.body.regularHours >= 0);
  assert.ok(typeof salaryResponse.body.totalPayOre === 'number');
});

test('worker CRUD supports create update and fetch by id', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const created = await request(app)
    .post('/api/v1/workers')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      fullName: 'Erik Builder',
      role: 'painter',
      hourlyRateOre: 23000,
      skillTags: ['painting', 'finishing'],
      brigadeName: 'Brigade C',
      phone: '+47 900 00 000',
      email: 'erik.builder@masterhaus.no',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      bio: 'Finishing specialist with renovation experience',
      isActive: true
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.fullName, 'Erik Builder');
  assert.equal(created.body.photoUrl, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');

  const updated = await request(app)
    .put(`/api/v1/workers/${created.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      hourlyRateOre: 25500,
      brigadeName: 'Brigade D',
      phone: '+47 911 11 111',
      bio: 'Now leading premium finishing jobs',
      isActive: false
    });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.hourlyRateOre, 25500);
  assert.equal(updated.body.brigadeName, 'Brigade D');
  assert.equal(updated.body.isActive, false);

  const fetched = await request(app)
    .get(`/api/v1/workers/${created.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.id, created.body.id);
  assert.equal(fetched.body.hourlyRateOre, 25500);
  assert.equal(fetched.body.phone, '+47 911 11 111');
  assert.equal(fetched.body.bio, 'Now leading premium finishing jobs');

  const deleted = await request(app)
    .delete(`/api/v1/workers/${created.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(deleted.status, 204);

  const missing = await request(app)
    .get(`/api/v1/workers/${created.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(missing.status, 404);
});

test('time entries CRUD updates salary preview for a worker', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const ordersResponse = await request(app)
    .get('/api/v1/orders')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  const createdWorker = await request(app)
    .post('/api/v1/workers')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      fullName: 'Nora Hours',
      role: 'installer',
      hourlyRateOre: 30000,
      skillTags: ['installation'],
      brigadeName: 'Brigade H',
      isActive: true
    });

  assert.equal(createdWorker.status, 201);

  const createdEntry = await request(app)
    .post(`/api/v1/workers/${createdWorker.body.id}/time-entries`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      orderId: ordersResponse.body.items[0].id,
      month: '2026-09',
      regularHours: 120,
      overtimeHours: 10
    });

  assert.equal(createdEntry.status, 201);
  assert.equal(createdEntry.body.regularHours, 120);

  const updatedEntry = await request(app)
    .put(`/api/v1/time-entries/${createdEntry.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({ regularHours: 132, overtimeHours: 8 });

  assert.equal(updatedEntry.status, 200);
  assert.equal(updatedEntry.body.regularHours, 132);

  const entriesResponse = await request(app)
    .get(`/api/v1/workers/${createdWorker.body.id}/time-entries?month=2026-09`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(entriesResponse.status, 200);
  assert.equal(entriesResponse.body.items.length, 1);

  const salaryResponse = await request(app)
    .get(`/api/v1/workers/${createdWorker.body.id}/salary?month=2026-09`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(salaryResponse.status, 200);
  assert.equal(salaryResponse.body.regularHours, 132);
  assert.equal(salaryResponse.body.overtimeHours, 8);
  assert.equal(salaryResponse.body.totalPayOre, 4056000);
  assert.equal(salaryResponse.body.advancesPaidOre, 0);
  assert.equal(salaryResponse.body.remainingPayOre, 4056000);

  const deletedEntry = await request(app)
    .delete(`/api/v1/time-entries/${createdEntry.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(deletedEntry.status, 204);

  const emptyEntriesResponse = await request(app)
    .get(`/api/v1/workers/${createdWorker.body.id}/time-entries?month=2026-09`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(emptyEntriesResponse.status, 200);
  assert.equal(emptyEntriesResponse.body.items.length, 0);
});

test('cloudinary signature endpoint returns upload credentials when configured', async () => {
  const previousCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const previousApiKey = process.env.CLOUDINARY_API_KEY;
  const previousApiSecret = process.env.CLOUDINARY_API_SECRET;
  process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  process.env.CLOUDINARY_API_KEY = 'demo-key';
  process.env.CLOUDINARY_API_SECRET = 'demo-secret';

  try {
    const app = createApp();

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

    const response = await request(app)
      .post('/api/v1/uploads/worker-photo/sign')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({});

    assert.equal(response.status, 200);
    assert.equal(response.body.cloudName, 'demo-cloud');
    assert.equal(response.body.apiKey, 'demo-key');
    assert.equal(response.body.folder, 'masterhaus/workers');
    assert.ok(response.body.signature);
  } finally {
    process.env.CLOUDINARY_CLOUD_NAME = previousCloudName;
    process.env.CLOUDINARY_API_KEY = previousApiKey;
    process.env.CLOUDINARY_API_SECRET = previousApiSecret;
  }
});

test('worker advances are stored with date and reduce remaining salary', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const workersResponse = await request(app)
    .get('/api/v1/workers')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  const workerId = workersResponse.body.items[0].id;

  const createdAdvance = await request(app)
    .post(`/api/v1/workers/${workerId}/advances`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      advanceDate: '2026-07-09',
      amountOre: 125000,
      note: 'Cash advance'
    });

  assert.equal(createdAdvance.status, 201);
  assert.equal(createdAdvance.body.amountOre, 125000);

  const listResponse = await request(app)
    .get(`/api/v1/workers/${workerId}/advances?month=2026-07`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.items));
  assert.ok(listResponse.body.items.some((item: { id: string }) => item.id === createdAdvance.body.id));

  const salaryResponse = await request(app)
    .get(`/api/v1/workers/${workerId}/salary?month=2026-07`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(salaryResponse.status, 200);
  assert.equal(salaryResponse.body.advancesPaidOre >= 125000, true);
  assert.equal(salaryResponse.body.remainingPayOre, salaryResponse.body.totalPayOre - salaryResponse.body.advancesPaidOre);

  const deletedAdvance = await request(app)
    .delete(`/api/v1/worker-advances/${createdAdvance.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(deletedAdvance.status, 204);
});

test('orders endpoint supports search and status updates', async () => {
  const app = createApp();
  const uniqueOrderNumber = `MH-SEARCH-${Date.now()}`;

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const createdOrder = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      orderNumber: uniqueOrderNumber,
      title: 'Kitchen rebuild Stavanger',
      status: 'planned',
      budgetTotalOre: 9900000,
      deadlineDate: '2026-10-10'
    });

  assert.equal(createdOrder.status, 201);

  const searchResponse = await request(app)
    .get('/api/v1/orders?q=Stavanger')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(searchResponse.status, 200);
  assert.ok(searchResponse.body.items.some((item: { id: string }) => item.id === createdOrder.body.id));

  const updatedOrder = await request(app)
    .put(`/api/v1/orders/${createdOrder.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({ status: 'completed' });

  assert.equal(updatedOrder.status, 200);
  assert.equal(updatedOrder.body.status, 'completed');
});

test('daily work logs track start, end, date and total worked time', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const workersResponse = await request(app)
    .get('/api/v1/workers')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  const workerId = workersResponse.body.items[0].id;

  const createdLog = await request(app)
    .post(`/api/v1/workers/${workerId}/work-logs`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      workDate: '2026-07-08',
      startedAt: '08:00',
      endedAt: '16:30'
    });

  assert.equal(createdLog.status, 201);
  assert.equal(createdLog.body.totalMinutes, 510);

  const updatedLog = await request(app)
    .put(`/api/v1/work-logs/${createdLog.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      workDate: '2026-07-08',
      startedAt: '08:15',
      endedAt: '17:00'
    });

  assert.equal(updatedLog.status, 200);
  assert.equal(updatedLog.body.totalMinutes, 525);

  const listResponse = await request(app)
    .get(`/api/v1/workers/${workerId}/work-logs?month=2026-07`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.items));
  assert.ok(listResponse.body.items.some((item: { id: string }) => item.id === createdLog.body.id));

  const deletedLog = await request(app)
    .delete(`/api/v1/work-logs/${createdLog.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(deletedLog.status, 204);
});
