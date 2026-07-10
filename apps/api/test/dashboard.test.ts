import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('dashboard endpoint returns overview and alerts', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const response = await request(app)
    .get('/api/v1/dashboard/live-overview')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.orders?.length >= 1);
  assert.ok(Array.isArray(response.body.alerts));
});
