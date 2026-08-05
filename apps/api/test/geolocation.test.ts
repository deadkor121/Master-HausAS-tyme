import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('worker geofence marks leave event and stores photo reports', async () => {
  const app = createApp();
  const suffix = Date.now();
  const workerEmail = `geo-worker-${suffix}@example.com`;

  const registerResponse = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: workerEmail,
      password: 'Worker123!',
      fullName: `Geo Worker ${suffix}`,
      role: 'worker',
      phone: '+47 901 11 111',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    });

  assert.equal(registerResponse.status, 201);
  const workerToken = registerResponse.body.accessToken as string;
  const workerId = registerResponse.body.user.workerId as string;
  assert.ok(workerToken);
  assert.ok(workerId);

  const createSiteResponse = await request(app)
    .post(`/api/v1/workers/${workerId}/work-site`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      address: 'Storgata 10, Oslo',
      latitude: 59.9139,
      longitude: 10.7522,
      radiusMeters: 5
    });

  assert.equal(createSiteResponse.status, 201, JSON.stringify(createSiteResponse.body));
  const siteId = createSiteResponse.body.id as string;
  assert.ok(siteId);

  const leavePingResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/pings`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      latitude: 59.915,
      longitude: 10.755,
      accuracyMeters: 4
    });

  assert.equal(leavePingResponse.status, 201);
  assert.equal(leavePingResponse.body.isInside, false);

  const disableWithoutReasonResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/geolocation-state`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({ enabled: false });

  assert.equal(disableWithoutReasonResponse.status, 400);

  const disableWithReasonResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/geolocation-state`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({ enabled: false, reason: 'Телефон разрядился, подключаю powerbank' });

  assert.equal(disableWithReasonResponse.status, 200);
  assert.equal(disableWithReasonResponse.body.site.geolocationEnabled, false);
  assert.equal(disableWithReasonResponse.body.site.geolocationDisabledReason, 'Телефон разрядился, подключаю powerbank');

  const pingWhenDisabledResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/pings`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      latitude: 59.915,
      longitude: 10.755,
      accuracyMeters: 4
    });

  assert.equal(pingWhenDisabledResponse.status, 409);

  const enableBackResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/geolocation-state`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({ enabled: true });

  assert.equal(enableBackResponse.status, 200);
  assert.equal(enableBackResponse.body.site.geolocationEnabled, true);

  const pingAfterResumeResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/pings`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      latitude: 59.9142,
      longitude: 10.7528,
      accuracyMeters: 6
    });

  assert.equal(pingAfterResumeResponse.status, 201);

  const startShiftResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/start-shift`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      photoUrls: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      note: 'Сегодня план: монтаж проводки и подготовка зоны кухни'
    });

  assert.equal(startShiftResponse.status, 201);
  assert.equal(startShiftResponse.body.site.isShiftActive, true);

  const finishShiftResponse = await request(app)
    .post(`/api/v1/work-sites/${siteId}/finish-shift`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      photoUrls: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      note: 'Завершили монтаж, убрали площадку и подготовили материалы на завтра'
    });

  assert.equal(finishShiftResponse.status, 201);
  assert.equal(finishShiftResponse.body.site.isShiftActive, false);
  assert.equal(finishShiftResponse.body.totalMinutes >= 1, true);

  const workLogsResponse = await request(app)
    .get(`/api/v1/workers/${workerId}/work-logs`)
    .set('Authorization', `Bearer ${workerToken}`);

  assert.equal(workLogsResponse.status, 200);
  assert.equal(Array.isArray(workLogsResponse.body.items), true);
  assert.equal(workLogsResponse.body.items.length >= 1, true);

  const reportResponse = await request(app)
    .post(`/api/v1/workers/${workerId}/photo-reports`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      workDate: '2026-08-04',
      photoUrls: [
        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        'https://res.cloudinary.com/demo/image/upload/sample.jpg'
      ],
      note: 'Finished wall prep and cable routing'
    });

  assert.equal(reportResponse.status, 201);

  const reportsListResponse = await request(app)
    .get(`/api/v1/workers/${workerId}/photo-reports?month=2026-08`)
    .set('Authorization', `Bearer ${workerToken}`);

  assert.equal(reportsListResponse.status, 200);
  assert.ok(Array.isArray(reportsListResponse.body.items));
  assert.equal(reportsListResponse.body.items.length >= 1, true);
  const manualReport = reportsListResponse.body.items.find((entry: { note?: string; photoUrls?: string[] }) => entry.note === 'Finished wall prep and cable routing');
  assert.ok(manualReport);
  assert.ok(Array.isArray(manualReport.photoUrls));
  assert.equal(manualReport.photoUrls.length, 2);
  assert.equal(reportsListResponse.body.items.some((entry: { reportType?: string }) => entry.reportType === 'start'), true);
  assert.equal(reportsListResponse.body.items.some((entry: { reportType?: string }) => entry.reportType === 'end'), true);

  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@masterhaus.no', password: 'Masterhaus123!' });
  assert.equal(adminLogin.status, 200);

  const geoStatusResponse = await request(app)
    .get('/api/v1/workers/geo-status')
    .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);

  assert.equal(geoStatusResponse.status, 200);
  const item = geoStatusResponse.body.items.find((entry: { workerId: string }) => entry.workerId === workerId);
  assert.ok(item);
  assert.equal(item.hasLeftSite, true);
  assert.ok(item.site?.leftAt);
  assert.equal(item.site?.geolocationEnabled, true);
});
