import { describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync } from 'node:zlib';
import { backupToTelegram } from '../src/lib/server/backup';
import { ObjectId } from 'mongodb';

describe('backup service', () => {
  it('throws SETUP_REQUIRED when Telegram env vars are missing', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalChatId = process.env.TELEGRAM_CHAT_ID;

    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    try {
      await expect(backupToTelegram(new ObjectId())).rejects.toThrow(
        'TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID',
      );
    } finally {
      if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
      if (originalChatId) process.env.TELEGRAM_CHAT_ID = originalChatId;
    }
  });

  it('compresses and decompresses backup payload losslessly', () => {
    const mockData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      database: 'kredit',
      summary: { customers: 2, credits: 1 },
      collections: {
        customers: [{ name: 'Budi' }, { name: 'Siti' }],
        credits: [{ contractNumber: 'CR-2026-000001', amount: 5000000 }],
      },
    };

    const jsonStr = JSON.stringify(mockData);
    const compressed = gzipSync(Buffer.from(jsonStr, 'utf-8'));
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = gunzipSync(compressed).toString('utf-8');
    const parsed = JSON.parse(decompressed);

    expect(parsed).toEqual(mockData);
    expect(parsed.collections.customers).toHaveLength(2);
  });
});
