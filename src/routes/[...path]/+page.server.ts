import { error, fail, redirect } from '@sveltejs/kit';
import { loadView } from '$lib/server/views';
import { id } from '$lib/server/db';
import { savePerson, deletePerson } from '$lib/server/people';
import { saveCredit, deleteCredit } from '$lib/server/credits';
import { createPayment, paymentPreview } from '$lib/server/payments';
import { backupToTelegram } from '$lib/server/backup';
import { DomainError, safeError } from '$lib/server/errors';
import { creditSchema } from '$lib/schemas/forms';
import {
  calculateCreditPrice,
  calculateFinancedAmount,
  calculateProfit,
  generateInstallments,
} from '$lib/server/finance';
import { businessDate } from '$lib/utils/dates';
import { rupiah } from '$lib/utils/money';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params, url }) => {
  try {
    return { view: await loadView(params.path, url) };
  } catch (e) {
    if (e instanceof DomainError && e.code.includes('NOT_FOUND')) error(404, e.message);
    throw e;
  }
};
export const actions: Actions = {
  save: async ({ request, params, locals }) => {
    const [section, recordId, operation] = params.path.split('/'),
      form = await request.formData();
    const values = Object.fromEntries(
      [...form.entries()].filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    let target = '';
    try {
      if (!locals.user) throw new DomainError('UNAUTHORIZED', 'Silakan masuk kembali.');
      if (recordId !== 'new' && operation !== 'edit')
        throw new DomainError('INVALID_ACTION', 'Formulir tidak valid.');
      const actor = id(locals.user.id);
      if (section === 'customers')
        target = `/${section}/${await savePerson(section, form, actor, operation === 'edit' ? recordId : undefined)}`;
      else if (section === 'credits')
        target = `/credits/${await saveCredit(values, actor, operation === 'edit' ? recordId : undefined, values.requestId)}`;
      else if (section === 'payments' && recordId === 'new')
        target = `/payments/${await createPayment(values, actor)}`;
      else throw new DomainError('INVALID_ACTION', 'Operasi tidak tersedia.');
    } catch (e) {
      return fail(400, { ...safeError(e), values });
    }
    redirect(303, target);
  },
  preview: async ({ request, params }) => {
    const form = await request.formData();
    const values = Object.fromEntries(
      [...form.entries()].filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    try {
      if (params.path.startsWith('payments/'))
        return { values, preview: [], schedule: await paymentPreview(values) };
      if (!params.path.startsWith('credits/'))
        throw new DomainError('INVALID_ACTION', 'Pratinjau tidak tersedia.');
      const input = creditSchema.parse(values),
        credit = calculateCreditPrice(input.purchasePrice, input.creditPrice),
        financed = calculateFinancedAmount(credit, input.downPayment);
      if (input.purchasePrice <= 0 || credit < input.purchasePrice)
        throw new DomainError(
          'INVALID_CREDIT_AMOUNT',
          'Harga beli harus lebih dari nol dan harga kredit minimal sama dengan harga beli.',
        );
      return {
        values,
        preview: [
          { label: 'Harga kredit', value: rupiah(credit) },
          { label: 'Keuntungan', value: rupiah(calculateProfit(input.purchasePrice, credit)) },
          { label: 'Jumlah dibiayai', value: rupiah(financed) },
        ],
        schedule: generateInstallments(
          financed,
          input.tenorMonths,
          businessDate(input.startDate),
        ).map((i) => ({
          sequence: i.sequence,
          amount: i.amount,
          dueDate: i.dueDate.toISOString(),
        })),
      };
    } catch (e) {
      return fail(400, { ...safeError(e), values });
    }
  },
  delete: async ({ request, params, locals }) => {
    const [section, recordId] = params.path.split('/');
    const form = await request.formData();
    try {
      if (!locals.user) throw new DomainError('UNAUTHORIZED', 'Silakan masuk kembali.');
      if (form.get('confirmation') !== recordId)
        throw new DomainError('CONFIRMATION_REQUIRED', 'Konfirmasi penghapusan diperlukan.');
      if (section === 'credits') await deleteCredit(recordId, id(locals.user.id));
      else if (section === 'customers') await deletePerson(section, recordId, id(locals.user.id));
      else throw new DomainError('INVALID_ACTION', 'Penghapusan tidak tersedia.');
    } catch (e) {
      return fail(400, safeError(e));
    }
    redirect(303, `/${section}`);
  },
  backup: async ({ locals }) => {
    try {
      if (!locals.user) throw new DomainError('UNAUTHORIZED', 'Silakan masuk kembali.');
      const actor = id(locals.user.id);
      const res = await backupToTelegram(actor);
      return {
        success: true,
        message: `Database berhasil dicadangkan (${res.fileName}, ${res.sizeKb} KB) dan dikirim ke Telegram!`,
      };
    } catch (e) {
      return fail(400, { ...safeError(e), success: false });
    }
  },
};
