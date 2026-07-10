import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('auth login returns JWT pair and allows access to protected orders endpoint', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  assert.equal(loginResponse.status, 200);
  assert.ok(loginResponse.body.accessToken);
  assert.ok(loginResponse.body.refreshToken);

  const ordersResponse = await request(app)
    .get('/api/v1/orders')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(ordersResponse.status, 200);
  assert.ok(Array.isArray(ordersResponse.body.items));
});
