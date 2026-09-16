import { afterAll, describe, expect, it, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import { storage } from '../src/lib/server/storage';
import { installCloudinaryFake } from './cloudinary-fake';

const restore = installCloudinaryFake();
afterAll(restore);
const png = Buffer.from('89504e470d0a1a0a', 'hex');

describe('Cloudinary KTP storage', () => {
  it('uploads authenticated assets, retrieves bytes, and deletes the same asset', async () => {
    const upload = vi.spyOn(cloudinary.uploader, 'upload');
    const download = vi.spyOn(cloudinary.utils, 'private_download_url');
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy');
    const photo = await storage.upload(new File([png], 'ktp.png', { type: 'image/png' }));
    const publicId = `kredit/ktp/${photo.storageKey.replace('.png', '')}`;
    expect(upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        public_id: publicId,
        type: 'authenticated',
        overwrite: false,
      }),
    );
    expect(await storage.get(photo.storageKey)).toEqual(png);
    expect(download).toHaveBeenCalledWith(
      publicId,
      'png',
      expect.objectContaining({
        type: 'authenticated',
        secure: true,
        expires_at: expect.any(Number),
      }),
    );
    await storage.delete(photo.storageKey);
    expect(destroy).toHaveBeenCalledWith(
      publicId,
      expect.objectContaining({
        type: 'authenticated',
        invalidate: true,
      }),
    );
    await expect(storage.get(photo.storageKey)).rejects.toThrow();
    vi.restoreAllMocks();
  });

  it('rejects spoofed images, empty files and invalid keys before contacting Cloudinary', async () => {
    await expect(
      storage.upload(new File(['bad'], 'ktp.png', { type: 'image/png' })),
    ).rejects.toThrow('valid');
    await expect(storage.upload(new File([], 'ktp.png', { type: 'image/png' }))).rejects.toThrow(
      '5 MB',
    );
    await expect(storage.get('../private')).rejects.toThrow('valid');
    await expect(storage.delete('../private')).rejects.toThrow('valid');
  });

  it('fails clearly when credentials are missing', async () => {
    vi.stubEnv('CLOUDINARY_API_SECRET', '');
    try {
      await expect(
        storage.upload(new File([png], 'ktp.png', { type: 'image/png' })),
      ).rejects.toThrow('Konfigurasi Cloudinary');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('handles unsuccessful downloads without returning provider errors', async () => {
    const photo = await storage.upload(new File([png], 'ktp.png', { type: 'image/png' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('provider error', { status: 403 })),
    );
    try {
      await expect(storage.get(photo.storageKey)).rejects.toThrow('Foto KTP gagal diambil.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
