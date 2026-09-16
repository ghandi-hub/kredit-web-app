import type { ClientSession } from 'mongodb';
import type { CreditDocument } from '../types/entities';
import type { connection } from './db';

// New credits store their own supplier name. Only old records need this fallback;
// saving an old credit replaces its reference with the submitted name.
export async function supplierName(
  c: Awaited<ReturnType<typeof connection>>,
  credit: CreditDocument,
  session?: ClientSession,
): Promise<string> {
  if (credit.supplierName !== undefined) return credit.supplierName;
  if (!credit.supplierId) return '';
  const legacy = await c.db
    .collection<{ name: string }>('suppliers')
    .findOne({ _id: credit.supplierId }, { projection: { name: 1 }, session });
  return legacy?.name || '';
}
