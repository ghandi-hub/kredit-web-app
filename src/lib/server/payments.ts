import type { ObjectId } from 'mongodb';
import { paymentSchema } from '../schemas/forms';
import { businessDate } from '../utils/dates';
import { audit, id, nextNumber, transaction, connection } from './db';
import { allocatePayment } from './finance';
import { DomainError } from './errors';
export async function paymentPreview(raw: unknown) {
  const input = paymentSchema.parse(raw);
  const c = await connection();
  const rows = await c.installments
    .find({ creditId: id(input.creditId) })
    .sort({ sequence: 1 })
    .toArray();
  return allocatePayment(input.amount, rows).map((a) => ({
    sequence: rows.find((i) => i._id.equals(a.installmentId))!.sequence,
    amount: a.amount,
  }));
}
export async function createPayment(raw: unknown, actorId: ObjectId) {
  const input = paymentSchema.parse(raw),
    paymentId = id(input.requestId),
    creditId = id(input.creditId);
  await transaction(async (c, session) => {
    const existing = await c.payments.findOne({ _id: paymentId }, { session });
    if (existing) {
      if (
        !existing.creditId.equals(creditId) ||
        existing.amount !== input.amount ||
        existing.method !== input.method ||
        existing.paymentDate.getTime() !== businessDate(input.paymentDate).getTime() ||
        existing.notes !== input.notes
      )
        throw new DomainError(
          'IDEMPOTENCY_CONFLICT',
          'Permintaan ini sudah digunakan untuk pembayaran lain. Muat ulang formulir.',
        );
      return;
    }
    const credit = await c.credits.findOne({ _id: creditId }, { session });
    if (!credit) throw new DomainError('CREDIT_NOT_FOUND', 'Kredit tidak ditemukan.');
    if (credit.status === 'PAID')
      throw new DomainError('CREDIT_ALREADY_PAID', 'Kredit sudah lunas.');
    const rows = await c.installments
      .find({ creditId }, { session })
      .sort({ sequence: 1 })
      .toArray();
    const outstanding = rows.reduce((sum, i) => sum + i.amount - i.paidAmount, 0);
    const paid = await c.payments.find({ creditId }, { session }).toArray();
    if (credit.creditPrice - paid.reduce((s, p) => s + p.amount, 0) !== outstanding)
      throw new DomainError(
        'INVALID_STATE',
        'Saldo kredit tidak konsisten. Pembayaran dihentikan.',
      );
    const allocations = allocatePayment(input.amount, rows);
    const now = new Date();
    // Every payment writes its parent, forcing overlapping transactions to retry from fresh state.
    await c.credits.updateOne(
      { _id: creditId },
      {
        $set: { status: input.amount === outstanding ? 'PAID' : 'ACTIVE', updatedAt: now },
        $inc: { revision: 1 },
      },
      { session },
    );
    for (const a of allocations)
      await c.installments.updateOne(
        { _id: a.installmentId },
        { $inc: { paidAmount: a.amount }, $set: { updatedAt: now } },
        { session },
      );
    const paymentNumber = await nextNumber(c, session, 'PAY', input.paymentDate.slice(0, 4));
    await c.payments.insertOne(
      {
        _id: paymentId,
        paymentNumber,
        creditId,
        customerId: credit.customerId,
        amount: input.amount,
        paymentDate: businessDate(input.paymentDate),
        method: input.method,
        type: input.amount === outstanding ? 'EARLY_SETTLEMENT' : 'INSTALLMENT',
        allocations,
        notes: input.notes,
        createdAt: now,
        receiptSnapshot: {
          creditPrice: credit.creditPrice,
          totalPaid: credit.creditPrice - outstanding + input.amount,
          outstanding: outstanding - input.amount,
        },
      },
      { session },
    );
    await audit(c, session, actorId, 'CREATE_PAYMENT', 'PAYMENT', paymentId, {
      paymentNumber,
      creditId: input.creditId,
      amount: input.amount,
    });
  });
  return paymentId.toHexString();
}
