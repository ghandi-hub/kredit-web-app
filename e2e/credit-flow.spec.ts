import { expect, test } from '@playwright/test';
test('protected routes, customer, credit, payment, receipt, mobile and logout', async ({
  page,
  request,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  const privatePhoto = await request.get('/ktp/000000000000000000000001', { maxRedirects: 0 });
  expect(privatePhoto.status()).toBe(303);
  await page.getByLabel('Nama pengguna').fill('e2eowner');
  await page.getByLabel('Kata sandi', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.screenshot({ path: 'test-results/dashboard-empty.png', fullPage: true });
  await page.goto('/customers/new');
  await page.getByLabel('Nama lengkap').fill('Pelanggan E2E');
  await page.getByLabel('NIK', { exact: false }).fill('0000000000000002');
  await page.getByLabel('Tanggal lahir').fill('1990-01-01');
  await page.getByLabel('Nomor telepon').fill('080000000002');
  await page.getByLabel('Alamat lengkap').fill('Alamat pengujian');
  await page.getByLabel('Foto KTP').setInputFiles({
    name: 'ktp.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5b8AAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pelanggan E2E');
  await page.goto('/credits/new');
  await page.getByLabel('Pelanggan', { exact: false }).selectOption({ label: 'Pelanggan E2E' });
  await expect(page.getByRole('link', { name: 'Supplier', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Supplier', { exact: false })).not.toHaveAttribute('required');
  await page.getByLabel('Supplier', { exact: false }).fill('Supplier E2E');
  await page.getByLabel('Nama barang').fill('Laptop Pengujian');
  await page.getByLabel('Harga beli').fill('1000000');
  await page.getByLabel('Uang muka').fill('200000');
  await page.getByLabel('Tenor').fill('3');
  await page.getByRole('button', { name: 'Pratinjau' }).click();
  await expect(page.getByRole('heading', { name: 'Pratinjau cicilan' })).toBeVisible();
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page).toHaveURL(/credits\/[a-f0-9]{24}$/);
  const creditUrl = page.url();
  await expect(page.getByRole('heading', { name: 'Jadwal cicilan' })).toBeVisible();
  await page.getByRole('link', { name: 'Catat pembayaran', exact: true }).click();
  await page.getByLabel('Nominal pembayaran').fill('500000');
  await page.getByRole('button', { name: 'Pratinjau' }).click();
  await expect(page.getByRole('heading', { name: 'Pratinjau alokasi' })).toBeVisible();
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bukti pembayaran.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cetak / Simpan PDF' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'test-results/receipt.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.goto(creditUrl);
  await page.getByRole('link', { name: 'Catat pembayaran', exact: true }).click();
  await page.getByLabel('Nominal pembayaran').fill('700001');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('melebihi');
  await expect(page.getByLabel('Nominal pembayaran')).toHaveValue('700001');
  await page.getByLabel('Nominal pembayaran').fill('700000');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bukti pembayaran.' })).toBeVisible();
  await page.goto(creditUrl);
  await expect(page.getByRole('link', { name: 'Catat pembayaran', exact: true })).toHaveCount(0);
  await expect(page.locator('tbody .badge').filter({ hasText: 'Lunas' })).toHaveCount(3);
  await page.goto('/dashboard');
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Buka menu' }).click();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
