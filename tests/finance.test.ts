import { describe, expect, it } from 'vitest';
import {
  allocatePayment,
  calculateCreditPrice,
  calculateFinancedAmount,
  calculateProfit,
  generateInstallments,
  getInstallmentStatus,
} from '../src/lib/server/finance';
import { businessDate, businessToday, calculateDueDate } from '../src/lib/utils/dates';
describe('financial invariants', () => {
  it('calculates actual prices and integer rounding', () => {
    expect(calculateCreditPrice(10000000)).toBe(14000000);
    expect(calculateCreditPrice(10000000, 13500000)).toBe(13500000);
    expect(calculateProfit(10000000, 13500000)).toBe(3500000);
    expect(calculateCreditPrice(11)).toBe(15);
  });
  it('accepts zero DP and exact DP, rejects invalid amounts', () => {
    expect(calculateFinancedAmount(14000000, 2000000)).toBe(12000000);
    expect(calculateFinancedAmount(14, 0)).toBe(14);
    expect(calculateFinancedAmount(14, 14)).toBe(0);
    expect(() => calculateFinancedAmount(14, 15)).toThrow();
    expect(() => calculateCreditPrice(1.5)).toThrow();
  });
  it('preserves installment sums including zero and remainders', () => {
    expect(
      generateInstallments(10000000, 3, businessDate('2026-01-31')).map((i) => i.amount),
    ).toEqual([3333333, 3333333, 3333334]);
    for (const total of [0, 1, 100, 999999])
      for (const tenor of [1, 3, 12])
        expect(
          generateInstallments(total, tenor, businessDate('2026-01-31')).reduce(
            (s, i) => s + i.amount,
            0,
          ),
        ).toBe(total);
  });
  it('clamps dates and returns to the original due day', () => {
    const d = businessDate('2028-01-31');
    expect(businessToday(calculateDueDate(d, 1))).toBe('2028-02-29');
    expect(businessToday(calculateDueDate(d, 2))).toBe('2028-03-31');
    expect(businessToday(calculateDueDate(businessDate('2026-01-31'), 1))).toBe('2026-02-28');
  });
  const rows = [1, 2, 3].map((n) => ({ _id: n, sequence: n, amount: 1000000, paidAmount: 0 }));
  it('allocates partial, multiple, exact settlement, sorted and mixed payments', () => {
    expect(allocatePayment(400000, rows)).toEqual([{ installmentId: 1, amount: 400000 }]);
    expect(allocatePayment(2500000, [...rows].reverse()).map((i) => i.amount)).toEqual([
      1000000, 1000000, 500000,
    ]);
    expect(allocatePayment(3000000, rows).reduce((s, i) => s + i.amount, 0)).toBe(3000000);
    expect(
      allocatePayment(1000000, [{ ...rows[0], paidAmount: 500000 }, ...rows.slice(1)]).map(
        (i) => i.amount,
      ),
    ).toEqual([500000, 500000]);
  });
  it('rejects overpayment and zero without changing inputs', () => {
    expect(() => allocatePayment(3000001, rows)).toThrow('melebihi');
    expect(() => allocatePayment(0, rows)).toThrow();
    expect(rows[0].paidAmount).toBe(0);
  });
  it('derives statuses without late fees', () => {
    const i = { amount: 100, paidAmount: 0, dueDate: businessDate('2026-09-15') };
    expect(getInstallmentStatus(i, '2026-09-14')).toBe('UPCOMING');
    expect(getInstallmentStatus(i, '2026-09-15')).toBe('DUE');
    expect(getInstallmentStatus(i, '2026-09-16')).toBe('OVERDUE');
    expect(getInstallmentStatus({ ...i, paidAmount: 1 }, '2026-09-16')).toBe('PARTIAL');
    expect(getInstallmentStatus({ ...i, paidAmount: 100 })).toBe('PAID');
    expect(i.amount).toBe(100);
  });
});
