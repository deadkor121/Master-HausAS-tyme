import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('create and retrieve order with auth', async () => {
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
      title: 'Kitchen renovation',
      status: 'planned',
      budgetTotalOre: 4000000,
      deadlineDate: '2026-09-15'
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'Kitchen renovation');

  const fetched = await request(app)
    .get(`/api/v1/orders/${created.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.orderNumber, orderNumber);
});
