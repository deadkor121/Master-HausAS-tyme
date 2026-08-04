import { test, expect } from '@playwright/test';

const adminEmail = 'admin@masterhaus.no';
const adminPassword = 'Masterhaus123!';

async function loginAsAdmin(page) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  await page.goto('/login');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
  }, { token: payload.accessToken, user: payload.user });
}

test('admin dashboard shows live geofence alert and updates automatically', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = Date.now();
  const workerEmail = `e2e-geo-${stamp}@example.com`;
  const workerName = `E2E Geo Worker ${stamp}`;

  const registerResponse = await page.request.post('/api/v1/auth/register', {
    data: {
      email: workerEmail,
      password: 'Worker123!',
      fullName: workerName,
      role: 'worker',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    }
  });
  expect(registerResponse.ok()).toBeTruthy();
  const registerPayload = await registerResponse.json();
  const workerId = registerPayload.user.workerId;
  const workerToken = registerPayload.accessToken;

  const siteResponse = await page.request.post(`/api/v1/workers/${workerId}/work-site`, {
    headers: { Authorization: `Bearer ${workerToken}` },
    data: {
      address: 'Storgata 10, Oslo',
      latitude: 59.9139,
      longitude: 10.7522,
      radiusMeters: 5
    }
  });
  expect(siteResponse.ok()).toBeTruthy();
  const sitePayload = await siteResponse.json();

  await page.goto('/dashboard?refreshMs=1000');
  await expect(page.getByText('Кто вышел из зоны сейчас')).toBeVisible();
  const refreshLabel = page.getByText('Обновление каждые', { exact: false }).first();
  const initialRefreshText = await refreshLabel.textContent();

  await page.request.post(`/api/v1/work-sites/${sitePayload.id}/pings`, {
    headers: { Authorization: `Bearer ${workerToken}` },
    data: {
      latitude: 59.915,
      longitude: 10.755,
      accuracyMeters: 4
    }
  });

  await expect(page.getByText(workerName)).toBeVisible({ timeout: 15_000 });
  const workerCard = page.getByText(workerName).locator('xpath=..');
  await expect(workerCard).toContainText('Вышел:', { timeout: 15_000 });
  if (initialRefreshText) {
    await expect(refreshLabel).not.toHaveText(initialRefreshText, { timeout: 15_000 });
  }
});
