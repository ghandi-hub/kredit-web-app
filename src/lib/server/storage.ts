import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { DomainError } from './errors';
import type { KtpPhoto } from '../types/entities';
export interface FileStorageService {
  upload(file: File): Promise<KtpPhoto>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
function config() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret)
    throw new DomainError('STORAGE_CONFIG', 'Konfigurasi Cloudinary belum lengkap.');
  return { cloud_name, api_key, api_secret, secure: true, timeout: 30000 };
}
function asset(key: string) {
  const match =
    /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(png|jpg|webp)$/.exec(key);
  if (!match) throw new DomainError('FILE_INVALID', 'Berkas tidak valid.');
  return { publicId: `kredit/ktp/${match[1]}`, format: match[2] };
}
export const storage: FileStorageService = {
  async upload(file) {
    if (!file.size || file.size > 5 * 1024 * 1024)
      throw new DomainError('FILE_TOO_LARGE', 'Foto KTP wajib diisi dan maksimal 5 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? 'image/jpeg'
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
          ? 'image/webp'
          : '';
    const ext = file.name.split('.').at(-1)?.toLowerCase();
    if (
      !mime ||
      mime !== file.type ||
      !(mime === 'image/png'
        ? ext === 'png'
        : mime === 'image/jpeg'
          ? ['jpg', 'jpeg'].includes(ext || '')
          : ext === 'webp')
    )
      throw new DomainError('FILE_INVALID', 'Gunakan foto JPG, PNG, atau WebP yang valid.');
    const key = `${randomUUID()}.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`;
    await cloudinary.uploader.upload(`data:${mime};base64,${bytes.toString('base64')}`, {
      ...config(),
      public_id: asset(key).publicId,
      resource_type: 'image',
      type: 'authenticated',
      overwrite: false,
      timeout: 60000,
    });
    return {
      storageKey: key,
      originalName: file.name.slice(0, 200),
      mimeType: mime,
      size: file.size,
      uploadedAt: new Date(),
    };
  },
  async get(key) {
    const { publicId, format } = asset(key);
    const url = cloudinary.utils.private_download_url(publicId, format, {
      ...config(),
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new DomainError('STORAGE_ERROR', 'Foto KTP gagal diambil.');
    return Buffer.from(await response.arrayBuffer());
  },
  async delete(key) {
    const { publicId } = asset(key);
    const result = await cloudinary.uploader.destroy(publicId, {
      ...config(),
      resource_type: 'image',
      type: 'authenticated',
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found')
      throw new DomainError('STORAGE_ERROR', 'Foto KTP gagal dihapus.');
  },
};
