import { rupiah } from './money';

export function buildWhatsAppUrl(
  phone: string,
  customerName: string,
  itemName: string,
  amount: number,
  dueDate: string,
  status?: string,
) {
  if (!phone) return '';
  const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62');
  let message = `Halo Bapak/Ibu ${customerName}, kami mengingatkan terkait cicilan ${itemName}`;
  if (status === 'Terlambat') {
    message += ` sebesar ${rupiah(amount)} yang telah melewati jatuh tempo pada ${dueDate}. Mohon untuk segera melakukan pembayaran. Terima kasih.`;
  } else if (status === 'Jatuh tempo' || status === 'Hari ini') {
    message += ` sebesar ${rupiah(amount)} yang jatuh tempo pada hari ini (${dueDate}). Terima kasih.`;
  } else {
    message += ` sebesar ${rupiah(amount)}, jatuh tempo pada ${dueDate}. Terima kasih.`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
