import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('worker notification config endpoint is available for admin', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const response = await request(app)
    .get('/api/v1/notifications/workers/config')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.enabled, 'boolean');
  assert.equal(typeof response.body.recipientsCount, 'number');
});

test('order creation returns worker notification status', async () => {
  const app = createApp();
  const orderNumber = `MH-2026-${Date.now()}`;

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const created = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      orderNumber,
      title: 'Notification check order',
      status: 'planned',
      budgetTotalOre: 5000000,
      deadlineDate: '2026-09-20'
    });

  assert.equal(created.status, 201);
  assert.equal(typeof created.body.workerNotification?.skipped, 'boolean');
});
