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

test('refresh endpoint rotates tokens and returns a new access token', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  assert.equal(loginResponse.status, 200);
  assert.ok(loginResponse.body.refreshToken);

  const refreshResponse = await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: loginResponse.body.refreshToken });

  assert.equal(refreshResponse.status, 200);
  assert.ok(refreshResponse.body.accessToken);
  assert.ok(refreshResponse.body.refreshToken);

  const ordersResponse = await request(app)
    .get('/api/v1/orders')
    .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`);

  assert.equal(ordersResponse.status, 200);
});

test('worker registration stores self-filled profile fields on worker card', async () => {
  const app = createApp();
  const suffix = Date.now();
  const email = `worker-${suffix}@example.com`;
  const fullName = `Worker ${suffix}`;

  const registerResponse = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'Worker123!',
      fullName,
      role: 'worker',
      phone: '+47 900 00 000',
      brigadeName: 'Brigade Z',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      skillTags: ['painting', 'finishing'],
      bio: 'Self registered worker'
    });

  assert.equal(registerResponse.status, 201);
  assert.ok(registerResponse.body.user.workerId);

  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const workersResponse = await request(app)
    .get('/api/v1/workers')
    .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);

  assert.equal(workersResponse.status, 200);
  const worker = workersResponse.body.items.find((item: { email?: string; fullName: string }) => item.email === email || item.fullName === fullName);

  assert.ok(worker);
  assert.equal(worker.phone, '+47 900 00 000');
  assert.equal(worker.brigadeName, 'Brigade Z');
  assert.equal(worker.photoUrl, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
  assert.deepEqual(worker.skillTags, ['painting', 'finishing']);
  assert.equal(worker.bio, 'Self registered worker');
});
