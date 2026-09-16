import { z } from 'zod';
import { businessDate } from '../utils/dates';
const text = z.string().trim().min(1, 'Wajib diisi.').max(500, 'Maksimal 500 karakter.');
const optional = z.string().trim().max(2000).default('');
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Pilih data yang valid.');
const amount = z.coerce
  .number()
  .int('Gunakan Rupiah bulat.')
  .min(0, 'Tidak boleh negatif.')
  .max(Number.MAX_SAFE_INTEGER);
export const dateInput = z.string().refine((v) => {
  try {
    businessDate(v);
    return true;
  } catch {
    return false;
  }
}, 'Tanggal tidak valid.');
export const customerSchema = z.object({
  name: text,
  nik: z.string().regex(/^\d{16}$/, 'NIK harus 16 digit.'),
  dateOfBirth: dateInput,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, 'Nomor telepon tidak valid.'),
  address: text,
});
export const creditSchema = z.object({
  customerId: objectId,
  supplierName: z.string().trim().max(500, 'Maksimal 500 karakter.').default(''),
  itemName: text,
  brand: optional,
  model: optional,
  serialNumber: optional,
  notes: optional,
  purchasePrice: amount,
  creditPrice: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    amount.optional(),
  ),
  downPayment: amount,
  tenorMonths: z.coerce.number().int().positive('Tenor harus lebih dari nol.'),
  startDate: dateInput,
  method: z.enum(['CASH', 'TRANSFER', 'OTHER']),
});
export const paymentSchema = z.object({
  creditId: objectId,
  amount: amount.refine((v) => v > 0, 'Pembayaran harus lebih dari Rp0.'),
  paymentDate: dateInput,
  method: z.enum(['CASH', 'TRANSFER', 'OTHER']),
  notes: optional,
  requestId: objectId,
});
