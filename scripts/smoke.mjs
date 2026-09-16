import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Browser checks only. No database is started, seeded, or contacted.
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('Browser error:', error.message);
  });
  page.on('requestfailed', (request) =>
    console.error('Failed request:', request.url(), request.failure()?.errorText),
  );
  await page.goto(`${base}/dashboard`);
  assert.match(page.url(), /\/login$/);
  await page.getByRole('heading', { name: 'Masuk ke ruang kerja.' }).waitFor();
  assert.equal(await page.getByLabel('Nama pengguna').count(), 1);
  assert.equal(await page.getByLabel('Kata sandi', { exact: true }).count(), 1);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Tampilkan kata sandi' }).click();
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Sembunyikan kata sandi' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const photo = await page.request.get(`${base}/ktp/000000000000000000000001`, { maxRedirects: 0 });
  assert.equal(photo.status(), 303);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: login desktop/mobile, password toggle, protected routes, no browser errors. MongoDB skipped.',
  );
} finally {
  await browser.close();
}
