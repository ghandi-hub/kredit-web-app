import { ObjectId } from 'mongodb';
import { creditSchema } from '../schemas/forms';
import { businessDate, businessToday } from '../utils/dates';
import { audit, id, nextNumber, transaction } from './db';
import {
  calculateCreditPrice,
  calculateFinancedAmount,
  calculateProfit,
  generateInstallments,
} from './finance';
import { DomainError } from './errors';
import { supplierName } from './legacy-supplier';
export async function saveCredit(
  raw: unknown,
  actorId: ObjectId,
  recordId?: string,
  requestId?: string,
) {
  const input = creditSchema.parse(raw);
  const creditPrice = calculateCreditPrice(input.purchasePrice, input.creditPrice);
  if (input.purchasePrice <= 0 || creditPrice < input.purchasePrice)
    throw new DomainError(
      'INVALID_CREDIT_AMOUNT',
      'Harga beli harus lebih dari nol dan harga kredit minimal sama dengan harga beli.',
    );
  const financedAmount = calculateFinancedAmount(creditPrice, input.downPayment);
  const startDate = businessDate(input.startDate);
  const schedule = generateInstallments(financedAmount, input.tenorMonths, startDate);
  const creditId = recordId ? id(recordId) : requestId ? id(requestId) : new ObjectId();
  await transaction(async (c, session) => {
    const old = await c.credits.findOne({ _id: creditId }, { session });
    if (!recordId && old) {
      if (
        !old.customerId.equals(id(input.customerId)) ||
        (await supplierName(c, old, session)) !== input.supplierName ||
        old.purchasePrice !== input.purchasePrice ||
        old.creditPrice !== creditPrice ||
        old.downPayment !== input.downPayment ||
        old.tenorMonths !== input.tenorMonths ||
        old.startDate.getTime() !== startDate.getTime() ||
        old.item.name !== input.itemName
      )
        throw new DomainError(
          'IDEMPOTENCY_CONFLICT',
          'Permintaan ini sudah digunakan untuk kredit lain. Muat ulang formulir.',
        );
      return;
    }
    if (recordId && !old) throw new DomainError('CREDIT_NOT_FOUND', 'Kredit tidak ditemukan.');
    if (
      recordId &&
      (await c.payments.findOne({ creditId, type: { $ne: 'DOWN_PAYMENT' } }, { session }))
    )
      throw new DomainError(
        'CREDIT_LOCKED',
        'Kredit sudah memiliki pembayaran cicilan. Nominal dan jadwal tidak dapat diubah.',
      );
    if (
      old &&
      (old.downPayment !== input.downPayment || !old.customerId.equals(id(input.customerId)))
    )
      throw new DomainError(
        'CREDIT_LOCKED',
        'Pelanggan dan DP yang sudah tercatat tidak dapat diubah.',
      );
    const customerId = id(input.customerId);
    if (
      !(await c.customers.updateOne({ _id: customerId }, { $inc: { revision: 1 } }, { session }))
        .matchedCount
    )
      throw new DomainError('CUSTOMER_NOT_FOUND', 'Pelanggan tidak ditemukan.');
    const now = new Date();
    const contractNumber =
      old?.contractNumber || (await nextNumber(c, session, 'CR', input.startDate.slice(0, 4)));
    const value = {
      contractNumber,
      customerId,
      supplierName: input.supplierName,
      item: {
        name: input.itemName,
        brand: input.brand,
        model: input.model,
        serialNumber: input.serialNumber,
        notes: input.notes,
      },
      purchasePrice: input.purchasePrice,
      creditPrice,
      markupPercent:
        (calculateProfit(input.purchasePrice, creditPrice) / input.purchasePrice) * 100,
      profit: calculateProfit(input.purchasePrice, creditPrice),
      downPayment: input.downPayment,
      financedAmount,
      tenorMonths: input.tenorMonths,
      startDate,
      dueDay: Number(input.startDate.slice(8)),
      status: financedAmount === 0 ? ('PAID' as const) : ('ACTIVE' as const),
      updatedAt: now,
    };
    if (old) {
      await c.credits.updateOne(
        { _id: creditId },
        { $set: value, $unset: { supplierId: 1 }, $inc: { revision: 1 } },
        { session },
      );
      await c.installments.deleteMany({ creditId }, { session });
    } else await c.credits.insertOne({ _id: creditId, ...value, createdAt: now }, { session });
    await c.installments.insertMany(
      schedule.map((i) => ({
        _id: new ObjectId(),
        creditId,
        ...i,
        createdAt: now,
        updatedAt: now,
      })),
      { session },
    );
    if (!old && input.downPayment > 0)
      await c.payments.insertOne(
        {
          _id: new ObjectId(),
          paymentNumber: await nextNumber(c, session, 'PAY', input.startDate.slice(0, 4)),
          creditId,
          customerId,
          amount: input.downPayment,
          paymentDate: startDate,
          method: input.method,
          type: 'DOWN_PAYMENT',
          allocations: [],
          receiptSnapshot: {
            creditPrice,
            totalPaid: input.downPayment,
            outstanding: financedAmount,
          },
          createdAt: now,
        },
        { session },
      );
    await audit(c, session, actorId, old ? 'UPDATE_CREDIT' : 'CREATE_CREDIT', 'CREDIT', creditId, {
      contractNumber,
      creditPrice,
      financedAmount,
      previousCreditPrice: old?.creditPrice,
    });
  });
  return creditId.toHexString();
}
export async function deleteCredit(recordId: string, actorId: ObjectId) {
  await transaction(async (c, session) => {
    const creditId = id(recordId);
    const credit = await c.credits.findOneAndDelete({ _id: creditId }, { session });
    if (!credit) throw new DomainError('CREDIT_NOT_FOUND', 'Kredit tidak ditemukan.');
    const installments = await c.installments.deleteMany({ creditId }, { session });
    const payments = await c.payments.deleteMany({ creditId }, { session });
    await audit(c, session, actorId, 'DELETE_CREDIT', 'CREDIT', creditId, {
      contractNumber: credit.contractNumber,
      creditPrice: credit.creditPrice,
      installmentsDeleted: installments.deletedCount,
      paymentsDeleted: payments.deletedCount,
      deletedOn: businessToday(),
    });
  });
}
