import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('finance monthly report returns revenue expenses and profit', async () => {
  const app = createApp();

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const response = await request(app)
    .get('/api/v1/finance/monthly-report?month=2026-07')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(response.status, 200);
  assert.ok(typeof response.body.revenue === 'number');
  assert.ok(typeof response.body.netProfit === 'number');
  assert.equal(response.body.expenses.salaries, 8381000);
});

test('payments and expenses CRUD affect monthly finance report', async () => {
  const app = createApp();
  const month = `2026-${String((Date.now() % 12) + 1).padStart(2, '0')}-${String(Date.now()).slice(-2)}`;
  const reportMonth = month.slice(0, 7);

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });

  const ordersResponse = await request(app)
    .get('/api/v1/orders')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  const orderId = ordersResponse.body.items[0].id;

  const createdPayment = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      orderId,
      amountOre: 2500000,
      month: reportMonth
    });

  assert.equal(createdPayment.status, 201);
  assert.equal(createdPayment.body.amountOre, 2500000);

  const updatedPayment = await request(app)
    .put(`/api/v1/payments/${createdPayment.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({ amountOre: 3100000 });

  assert.equal(updatedPayment.status, 200);
  assert.equal(updatedPayment.body.amountOre, 3100000);

  const createdExpense = await request(app)
    .post('/api/v1/expenses')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      category: 'material',
      amountOre: 900000,
      month: reportMonth
    });

  assert.equal(createdExpense.status, 201);
  assert.equal(createdExpense.body.category, 'material');

  const updatedExpense = await request(app)
    .put(`/api/v1/expenses/${createdExpense.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({ category: 'transport', amountOre: 650000 });

  assert.equal(updatedExpense.status, 200);
  assert.equal(updatedExpense.body.category, 'transport');
  assert.equal(updatedExpense.body.amountOre, 650000);

  const payments = await request(app)
    .get(`/api/v1/payments?month=${reportMonth}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(payments.status, 200);
  assert.ok(payments.body.items.some((item: { id: string }) => item.id === createdPayment.body.id));

  const expenses = await request(app)
    .get(`/api/v1/expenses?month=${reportMonth}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(expenses.status, 200);
  assert.ok(expenses.body.items.some((item: { id: string }) => item.id === createdExpense.body.id));

  const report = await request(app)
    .get(`/api/v1/finance/monthly-report?month=${reportMonth}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(report.status, 200);
  assert.equal(report.body.revenue, 3100000);
  assert.equal(report.body.expenses.materials, 0);
  assert.equal(report.body.expenses.other, 650000);

  const deletedPayment = await request(app)
    .delete(`/api/v1/payments/${createdPayment.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(deletedPayment.status, 204);

  const deletedExpense = await request(app)
    .delete(`/api/v1/expenses/${createdExpense.body.id}`)
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

  assert.equal(deletedExpense.status, 204);
});
