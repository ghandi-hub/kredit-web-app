import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl } from '../src/lib/utils/whatsapp';

describe('WhatsApp reminder URL builder', () => {
  it('returns empty string if phone is empty', () => {
    expect(buildWhatsAppUrl('', 'Budi', 'TV', 500000, '15 Okt 2026')).toBe('');
  });

  it('formats Indonesian phone number correctly from 08... to 628...', () => {
    const url = buildWhatsAppUrl('0812-3456-7890', 'Budi', 'Samsung TV', 500000, '15 Okt 2026');
    expect(url).toContain('https://wa.me/6281234567890');
  });

  it('formats Indonesian phone number starting with +62 correctly', () => {
    const url = buildWhatsAppUrl('+62 812-3456-7890', 'Budi', 'Samsung TV', 500000, '15 Okt 2026');
    expect(url).toContain('https://wa.me/6281234567890');
  });

  it('customizes message for overdue status', () => {
    const url = buildWhatsAppUrl(
      '08123456789',
      'Siti',
      'Kulkas',
      750000,
      '10 Sep 2026',
      'Terlambat',
    );
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Halo Bapak/Ibu Siti');
    expect(decoded).toContain('Kulkas');
    expect(decoded).toContain('melewati jatuh tempo');
  });

  it('customizes message for due today status', () => {
    const url = buildWhatsAppUrl(
      '08123456789',
      'Ahmad',
      'Motor',
      1000000,
      '16 Sep 2026',
      'Jatuh tempo',
    );
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('jatuh tempo pada hari ini');
  });

  it('generates friendly upcoming reminder for any time', () => {
    const url = buildWhatsAppUrl(
      '08123456789',
      'Rina',
      'Laptop',
      600000,
      '25 Okt 2026',
      'Mendatang',
    );
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('jatuh tempo pada 25 Okt 2026');
  });
});
