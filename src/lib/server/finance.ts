import { DomainError } from './errors';
import { businessToday, calculateDueDate } from '../utils/dates';
export function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new DomainError('INVALID_AMOUNT', 'Nominal harus berupa Rupiah bulat, positif atau nol.');
  return value;
}
export function calculateCreditPrice(purchasePrice: number, override?: number) {
  money(purchasePrice);
  return money(
    override === undefined ? Number((BigInt(purchasePrice) * 140n + 50n) / 100n) : override,
  );
}
export const calculateProfit = (purchase: number, credit: number) =>
  money(credit) - money(purchase);
export function calculateFinancedAmount(credit: number, dp: number) {
  money(credit);
  money(dp);
  if (dp > credit)
    throw new DomainError('INVALID_DOWN_PAYMENT', 'DP tidak boleh melebihi harga kredit.');
  return credit - dp;
}
export function generateInstallments(financed: number, tenor: number, startDate: Date) {
  money(financed);
  if (!Number.isSafeInteger(tenor) || tenor <= 0)
    throw new DomainError('INVALID_TENOR', 'Tenor harus berupa jumlah bulan bulat lebih dari nol.');
  const base = Math.floor(financed / tenor);
  return Array.from({ length: tenor }, (_, i) => ({
    sequence: i + 1,
    amount: i === tenor - 1 ? financed - base * (tenor - 1) : base,
    paidAmount: 0,
    dueDate: calculateDueDate(startDate, i + 1),
  }));
}
export function getInstallmentStatus(
  i: { amount: number; paidAmount: number; dueDate: Date },
  today = businessToday(),
) {
  if (i.paidAmount >= i.amount) return 'PAID';
  if (i.paidAmount > 0) return 'PARTIAL';
  const due = businessToday(i.dueDate);
  return today > due ? 'OVERDUE' : today === due ? 'DUE' : 'UPCOMING';
}
export function allocatePayment<T>(
  amount: number,
  installments: { _id: T; sequence: number; amount: number; paidAmount: number }[],
) {
  money(amount);
  if (amount === 0)
    throw new DomainError('INVALID_PAYMENT_AMOUNT', 'Pembayaran harus lebih dari Rp0.');
  let remaining = amount;
  const allocations: { installmentId: T; amount: number }[] = [];
  for (const i of [...installments].sort((a, b) => a.sequence - b.sequence)) {
    if (!remaining) break;
    const outstanding = money(i.amount) - money(i.paidAmount);
    if (outstanding < 0) throw new DomainError('INVALID_STATE', 'Saldo cicilan tidak konsisten.');
    const allocated = Math.min(remaining, outstanding);
    if (allocated) allocations.push({ installmentId: i._id, amount: allocated });
    remaining -= allocated;
  }
  if (remaining)
    throw new DomainError('PAYMENT_EXCEEDS_OUTSTANDING', 'Pembayaran melebihi sisa tagihan.');
  return allocations;
}
