import { MongoServerError } from 'mongodb';
import { ZodError } from 'zod';
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function safeError(error: unknown) {
  if (error instanceof ZodError)
    return {
      code: 'VALIDATION_ERROR',
      message: 'Periksa kembali isian formulir.',
      fields: Object.fromEntries(error.issues.map((i) => [i.path.join('.'), i.message])),
    };
  if (error instanceof DomainError)
    return { code: error.code, message: error.message, fields: {} as Record<string, string> };
  if (error instanceof MongoServerError && error.code === 11000)
    return {
      code: 'DUPLICATE_DATA',
      message: 'Data atau NIK sudah terdaftar. Periksa kembali isian Anda.',
      fields: {} as Record<string, string>,
    };
  console.error('Operation failed:', error instanceof Error ? error.name : 'UnknownError');
  return {
    code: 'SERVER_ERROR',
    message: 'Operasi belum berhasil. Periksa koneksi database atau hubungi pengelola aplikasi.',
    fields: {} as Record<string, string>,
  };
}
