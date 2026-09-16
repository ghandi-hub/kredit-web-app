import { supplierName } from './legacy-supplier';
import { getBackupStatus } from './backup';
import { ObjectId, type Filter } from 'mongodb';
import { connection, id } from './db';
import { DomainError } from './errors';
import { getInstallmentStatus } from './finance';
import { businessDate, businessToday, formatDate } from '../utils/dates';
import { rupiah } from '../utils/money';
import type { AppView, Column, Field, Row } from '../types/ui';
import type { CreditDocument, PaymentDocument } from '../types/entities';
export const installmentColumns: Column[] = [
  { key: 'sequence', label: '#' },
  { key: 'dueDate', label: 'Jatuh tempo' },
  { key: 'amount', label: 'Nominal', money: true },
  { key: 'paidAmount', label: 'Dibayar', money: true },
  { key: 'remaining', label: 'Sisa', money: true },
  { key: 'status', label: 'Status' },
];
const creditColumns: Column[] = [
  { key: 'contractNumber', label: 'No. kredit' },
  { key: 'customerName', label: 'Pelanggan' },
  { key: 'itemName', label: 'Barang' },
  { key: 'creditPrice', label: 'Harga kredit', money: true },
  { key: 'totalPaid', label: 'Dibayar', money: true },
  { key: 'outstanding', label: 'Sisa piutang', money: true },
  { key: 'status', label: 'Status' },
];
const paymentColumns: Column[] = [
  { key: 'paymentNumber', label: 'No. pembayaran' },
  { key: 'customerName', label: 'Pelanggan' },
  { key: 'contractNumber', label: 'No. kredit' },
  { key: 'paymentDate', label: 'Tanggal' },
  { key: 'amount', label: 'Nominal', money: true },
  { key: 'method', label: 'Metode' },
];
const labels: Record<string, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  OTHER: 'Lainnya',
  ACTIVE: 'Aktif',
  PAID: 'Lunas',
  OVERDUE: 'Terlambat',
  DUE: 'Jatuh tempo',
  PARTIAL: 'Sebagian',
  UPCOMING: 'Mendatang',
};
const methods = [
  { value: 'CASH', label: 'Tunai' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'OTHER', label: 'Lainnya (termasuk QRIS)' },
];
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (row: Row, q: string) =>
  Object.values(row).some((v) => String(v).toLowerCase().includes(q.toLowerCase()));
async function creditRows(filter: Filter<CreditDocument> = {}) {
  const c = await connection();
  const docs = await c.credits
    .aggregate<CreditDocument & { customerName: string; totalPaid: number; overdueCount: number }>([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $lookup: {
          from: 'payments',
          let: { id: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$creditId', '$$id'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ],
          as: 'paid',
        },
      },
      {
        $lookup: {
          from: 'installments',
          let: { id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$creditId', '$$id'] },
                    { $lt: ['$dueDate', businessDate(businessToday())] },
                    { $lt: ['$paidAmount', '$amount'] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'overdue',
        },
      },
      {
        $set: {
          customerName: { $arrayElemAt: ['$customer.name', 0] },
          totalPaid: { $ifNull: [{ $arrayElemAt: ['$paid.total', 0] }, 0] },
          overdueCount: { $ifNull: [{ $arrayElemAt: ['$overdue.count', 0] }, 0] },
        },
      },
      { $project: { customer: 0, paid: 0, overdue: 0 } },
    ])
    .toArray();
  return docs.map(
    (d) =>
      ({
        id: d._id.toHexString(),
        href: `/credits/${d._id}`,
        contractNumber: d.contractNumber,
        customerName: d.customerName || '—',
        itemName: d.item.name,
        creditPrice: d.creditPrice,
        purchasePrice: d.purchasePrice,
        profit: d.profit,
        totalPaid: d.totalPaid,
        outstanding: d.creditPrice - d.totalPaid,
        status: labels[d.status],
        overdue: d.overdueCount,
        customerId: d.customerId.toHexString(),
        rawStatus: d.status,
        startDate: businessToday(d.startDate),
      }) satisfies Row,
  );
}
async function searchCreditRows(q: string) {
  if (!q) return creditRows();
  const c = await connection(),
    pattern = { $regex: escapeRegex(q), $options: 'i' };
  const customers = await c.customers
    .find(
      { $or: [{ name: pattern }, { nik: pattern }, { phone: pattern }] },
      { projection: { _id: 1 } },
    )
    .toArray();
  return creditRows({
    $or: [
      { contractNumber: pattern },
      { 'item.name': pattern },
      { customerId: { $in: customers.map((i) => i._id) } },
    ],
  });
}
async function paymentRows(filter: Filter<PaymentDocument> = {}) {
  const c = await connection();
  const docs = await c.payments
    .aggregate<PaymentDocument & { customerName: string; contractNumber: string }>([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $lookup: {
          from: 'credit_contracts',
          localField: 'creditId',
          foreignField: '_id',
          as: 'credit',
        },
      },
      {
        $set: {
          customerName: { $arrayElemAt: ['$customer.name', 0] },
          contractNumber: { $arrayElemAt: ['$credit.contractNumber', 0] },
        },
      },
      { $project: { customer: 0, credit: 0 } },
    ])
    .toArray();
  return docs.map(
    (d) =>
      ({
        id: d._id.toHexString(),
        href: `/payments/${d._id}`,
        paymentNumber: d.paymentNumber,
        customerName: d.customerName,
        contractNumber: d.contractNumber,
        paymentDate: formatDate(d.paymentDate),
        amount: d.amount,
        method: labels[d.method],
        type: d.type,
        rawDate: businessToday(d.paymentDate),
      }) satisfies Row,
  );
}
async function installmentRows(creditId?: ObjectId) {
  const c = await connection();
  const docs = await c.installments
    .aggregate<{
      _id: ObjectId;
      creditId: ObjectId;
      sequence: number;
      amount: number;
      paidAmount: number;
      dueDate: Date;
      customerName: string;
      phone: string;
      contractNumber: string;
    }>([
      { $match: creditId ? { creditId } : { $expr: { $lt: ['$paidAmount', '$amount'] } } },
      { $sort: creditId ? { sequence: 1 } : { dueDate: 1 } },
      {
        $lookup: {
          from: 'credit_contracts',
          localField: 'creditId',
          foreignField: '_id',
          as: 'credit',
        },
      },
      { $unwind: '$credit' },
      {
        $lookup: {
          from: 'customers',
          localField: 'credit.customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $set: {
          customerName: { $arrayElemAt: ['$customer.name', 0] },
          phone: { $arrayElemAt: ['$customer.phone', 0] },
          contractNumber: '$credit.contractNumber',
        },
      },
      { $project: { credit: 0, customer: 0 } },
    ])
    .toArray();
  return docs.map(
    (d) =>
      ({
        id: d._id.toHexString(),
        href: `/credits/${d.creditId}`,
        sequence: d.sequence,
        amount: d.amount,
        paidAmount: d.paidAmount,
        remaining: d.amount - d.paidAmount,
        dueDate: formatDate(d.dueDate),
        rawDueDate: businessToday(d.dueDate),
        status: labels[getInstallmentStatus(d)],
        customerName: d.customerName,
        phone: d.phone,
        contractNumber: d.contractNumber,
      }) satisfies Row,
  );
}
function empty(section: string): AppView {
  return {
    kind: 'list',
    section,
    title: '',
    subtitle: '',
    columns: [],
    rows: [],
    fields: [],
    values: {},
    details: [],
    installments: [],
    payments: [],
    metrics: [],
    requestId: new ObjectId().toHexString(),
    editHref: '',
    createHref: '',
    ktpHref: '',
    canDelete: false,
    canPay: false,
    locked: false,
    paymentHref: '',
    customerPhone: '',
    customerName: '',
    outstanding: 0,
    recordId: '',
    backupStatus: { lastBackupAt: null, daysAgo: null, needsBackup: false },
  };
}
function personFields(): Field[] {
  return [
    { name: 'name', label: 'Nama lengkap', required: true },
    { name: 'nik', label: 'NIK', required: true, help: '16 digit sesuai KTP.' },
    { name: 'dateOfBirth', label: 'Tanggal lahir', type: 'date', required: true },
    { name: 'phone', label: 'Nomor telepon', type: 'tel', required: true },
    { name: 'address', label: 'Alamat lengkap', type: 'textarea', required: true },
    {
      name: 'ktp',
      label: 'Foto KTP',
      type: 'file',
      help: 'JPG, PNG, atau WebP. Maksimal 5 MB. Disimpan secara privat.',
    },
  ];
}
export async function loadView(path: string, url: URL): Promise<AppView> {
  const [section = 'dashboard', recordId, operation] = path.split('/');
  if (
    !['dashboard', 'customers', 'credits', 'payments', 'reports', 'audit', 'search'].includes(
      section,
    ) ||
    path.split('/').length > 3
  )
    throw new DomainError('NOT_FOUND', 'Halaman tidak ditemukan.');
  const v = empty(section),
    c = await connection(),
    q = url.searchParams.get('q')?.trim().slice(0, 100) || '';
  if (section === 'search') {
    v.title = 'Hasil pencarian';
    v.subtitle = 'Temukan pelanggan, kredit, atau pembayaran dari satu tempat.';
    v.columns = [
      { key: 'category', label: 'Kategori' },
      { key: 'name', label: 'Nama / nomor' },
      { key: 'description', label: 'Keterangan' },
    ];
    if (!q) return v;
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    const [customers, credits, payments] = await Promise.all([
      c.customers
        .find(
          { $or: [{ name: pattern }, { nik: pattern }, { phone: pattern }] },
          { projection: { name: 1, phone: 1 } },
        )
        .toArray(),
      searchCreditRows(q),
      paymentRows(),
    ]);
    v.rows = [
      ...customers.map((i) => ({
        id: String(i._id),
        href: `/customers/${i._id}`,
        category: 'Pelanggan',
        name: i.name,
        description: i.phone,
      })),
      ...credits.map((i) => ({
        id: i.id,
        href: i.href,
        category: 'Kredit',
        name: i.contractNumber,
        description: `${i.customerName} · ${i.itemName}`,
      })),
      ...payments
        .filter((i) => matches(i, q))
        .map((i) => ({
          id: i.id,
          href: i.href,
          category: 'Pembayaran',
          name: i.paymentNumber,
          description: `${i.customerName} · ${i.contractNumber}`,
        })),
    ];
    return v;
  }
  if (section === 'dashboard') {
    const [credits, payments, installments, totalCustomers, backupStatus] = await Promise.all([
      creditRows(),
      paymentRows(),
      installmentRows(),
      c.customers.countDocuments(),
      getBackupStatus(),
    ]);
    const today = businessToday(),
      month = today.slice(0, 7),
      overdue = installments.filter((i) => i.rawDueDate < today);
    v.kind = 'dashboard';
    v.title = 'Dashboard';
    v.subtitle = 'Semua yang perlu Anda ketahui tentang usaha hari ini.';
    v.backupStatus = backupStatus;
    v.metrics = [
      {
        label: 'Total piutang',
        value: rupiah(credits.reduce((s, i) => s + Number(i.outstanding), 0)),
        note: `${credits.filter((i) => i.rawStatus === 'ACTIVE').length} kredit aktif`,
      },
      {
        label: 'Pembayaran hari ini',
        value: rupiah(
          payments.filter((i) => i.rawDate === today).reduce((s, i) => s + i.amount, 0),
        ),
        note: `${payments.filter((i) => i.rawDate === today).length} transaksi diterima`,
      },
      { label: 'Total pelanggan', value: String(totalCustomers), note: 'Pelanggan terdaftar' },
      {
        label: 'Keuntungan bulan ini',
        value: rupiah(
          credits.filter((i) => i.startDate.startsWith(month)).reduce((s, i) => s + i.profit, 0),
        ),
        note: 'Berdasarkan harga kredit aktual',
      },
    ];
    v.rows = installments.filter((i) => i.rawDueDate <= today);
    v.payments = payments.slice(0, 5);
    v.installments = installments;
    v.outstanding = overdue.reduce((s, i) => s + i.remaining, 0);
    v.details = [
      {
        label: 'Kredit lunas',
        value: String(credits.filter((i) => i.rawStatus === 'PAID').length),
      },
      {
        label: 'Pembayaran bulan ini',
        value: rupiah(
          payments.filter((i) => i.rawDate.startsWith(month)).reduce((s, i) => s + i.amount, 0),
        ),
      },
    ];
    return v;
  }
  if (section === 'customers') {
    const label = 'pelanggan';
    v.title = 'Pelanggan';
    v.subtitle = 'Identitas, kontak, dan riwayat kredit pelanggan Anda.';
    v.createHref = `/${section}/new`;
    if (recordId === 'new' || operation === 'edit') {
      v.kind = 'form';
      v.title = `${recordId === 'new' ? 'Tambah' : 'Edit'} ${label}`;
      v.fields = personFields();
    }
    if (recordId && recordId !== 'new') {
      const person = await c.db.collection(section).findOne({ _id: id(recordId) });
      if (!person) throw new DomainError('NOT_FOUND', 'Data tidak ditemukan.');
      v.recordId = recordId;
      v.values = Object.fromEntries(
        v.fields
          .filter((f) => f.type !== 'file')
          .map((f) => [
            f.name,
            f.type === 'date' ? businessToday(person[f.name]) : String(person[f.name] || ''),
          ]),
      );
      if (!operation) {
        v.kind = 'detail';
        v.title = person.name;
        v.editHref = `/${section}/${recordId}/edit`;
        v.canDelete = true;
        v.columns = creditColumns;
        v.rows = await creditRows({ customerId: id(recordId) });
        v.details = [
          { label: 'Nomor telepon', value: person.phone || '—' },
          { label: 'Alamat', value: person.address || '—' },
        ];
        {
          v.ktpHref = `/ktp/${recordId}`;
          v.details.unshift(
            { label: 'NIK', value: person.nik },
            { label: 'Tanggal lahir', value: formatDate(person.dateOfBirth) },
          );
          v.payments = await paymentRows({ customerId: id(recordId) });
          v.metrics = [
            {
              label: 'Total kredit',
              value: rupiah(v.rows.reduce((s, i) => s + Number(i.creditPrice), 0)),
              note: `${v.rows.length} transaksi`,
            },
            {
              label: 'Total dibayar',
              value: rupiah(v.rows.reduce((s, i) => s + Number(i.totalPaid), 0)),
              note: 'Termasuk DP',
            },
            {
              label: 'Sisa piutang',
              value: rupiah(v.rows.reduce((s, i) => s + Number(i.outstanding), 0)),
              note: 'Seluruh kredit pelanggan',
            },
          ];
        }
      }
    } else if (!recordId) {
      v.columns = [
        { key: 'name', label: 'Nama pelanggan' },
        { key: 'nik', label: 'NIK' },
        { key: 'phone', label: 'Telepon' },
        { key: 'address', label: 'Alamat' },
      ];
      const filter = q
        ? {
            $or: ['name', 'nik', 'phone'].map((key) => ({
              [key]: { $regex: escapeRegex(q), $options: 'i' },
            })),
          }
        : {};
      const people = await c.db.collection(section).find(filter).sort({ createdAt: -1 }).toArray();
      v.rows = people.map((p) => ({
        id: String(p._id),
        href: `/${section}/${p._id}`,
        name: p.name,
        nik: '•••• •••• •••• ' + p.nik.slice(-4),
        phone: p.phone || '—',
        address: p.address || '—',
      }));
    }
    return v;
  }
  if (section === 'credits') {
    v.title = 'Transaksi kredit';
    v.subtitle = 'Kelola pembiayaan, pantau cicilan, dan catat pelunasan.';
    v.columns = creditColumns;
    v.createHref = '/credits/new';
    if (!recordId) {
      v.rows = await searchCreditRows(q);
      const status = url.searchParams.get('status');
      if (status)
        v.rows = v.rows.filter((i) =>
          status === 'OVERDUE' ? Number(i.overdue) > 0 : i.rawStatus === status,
        );
      return v;
    }
    const credit = recordId === 'new' ? null : await c.credits.findOne({ _id: id(recordId) });
    if (recordId !== 'new' && !credit)
      throw new DomainError('CREDIT_NOT_FOUND', 'Kredit tidak ditemukan.');
    if (recordId === 'new' || operation === 'edit') {
      v.kind = 'form';
      v.title = credit ? 'Edit kredit' : 'Buat kredit baru';
      const customers = await c.customers
        .find({}, { projection: { name: 1 } })
        .sort({ name: 1 })
        .toArray();
      v.fields = [
        {
          name: 'customerId',
          label: 'Pelanggan',
          required: true,
          readonly: !!credit,
          options: customers.map((i) => ({ value: String(i._id), label: i.name })),
        },
        {
          name: 'supplierName',
          label: 'Supplier',
          help: 'Opsional. Isi nama toko atau tempat pembelian barang.',
        },
        { name: 'itemName', label: 'Nama barang', required: true },
        { name: 'brand', label: 'Merek' },
        { name: 'model', label: 'Model' },
        { name: 'serialNumber', label: 'Nomor seri' },
        { name: 'purchasePrice', label: 'Harga beli (Rp)', type: 'number', required: true },
        {
          name: 'creditPrice',
          label: 'Harga kredit (Rp)',
          type: 'number',
          help: 'Kosongkan untuk harga otomatis: harga beli + 40%.',
        },
        {
          name: 'downPayment',
          label: 'Uang muka / DP (Rp)',
          type: 'number',
          value: 0,
          required: true,
          readonly: !!credit,
        },
        { name: 'tenorMonths', label: 'Tenor (bulan)', type: 'number', value: 12, required: true },
        {
          name: 'startDate',
          label: 'Tanggal mulai kredit',
          type: 'date',
          value: businessToday(),
          required: true,
          help: 'Cicilan pertama satu bulan setelah tanggal ini.',
        },
        { name: 'method', label: 'Metode pembayaran DP', options: methods },
        { name: 'notes', label: 'Catatan barang', type: 'textarea' },
      ];
      if (credit) {
        v.locked = !!(await c.payments.findOne({
          creditId: credit._id,
          type: { $ne: 'DOWN_PAYMENT' },
        }));
        v.values = {
          customerId: String(credit.customerId),
          supplierName: await supplierName(c, credit),
          itemName: credit.item.name,
          brand: credit.item.brand || '',
          model: credit.item.model || '',
          serialNumber: credit.item.serialNumber || '',
          purchasePrice: String(credit.purchasePrice),
          creditPrice: String(credit.creditPrice),
          downPayment: String(credit.downPayment),
          tenorMonths: String(credit.tenorMonths),
          startDate: businessToday(credit.startDate),
          notes: credit.item.notes || '',
          method: 'CASH',
        };
      }
      return v;
    }
    if (credit) {
      const [customer, rows, payments] = await Promise.all([
        c.customers.findOne({ _id: credit.customerId }),
        installmentRows(credit._id),
        paymentRows({ creditId: credit._id }),
      ]);
      v.kind = 'detail';
      v.recordId = recordId;
      v.title = credit.contractNumber;
      v.subtitle = credit.item.name;
      v.installments = rows;
      v.payments = payments;
      v.outstanding = credit.creditPrice - payments.reduce((s, p) => s + p.amount, 0);
      v.canPay = v.outstanding > 0;
      v.paymentHref = `/payments/new?credit=${recordId}`;
      v.canDelete = true;
      v.editHref = `/credits/${recordId}/edit`;
      v.customerName = customer!.name;
      v.customerPhone = customer!.phone;
      v.details = [
        { label: 'Pelanggan', value: customer!.name },
        { label: 'Supplier', value: (await supplierName(c, credit)) || '—' },
        { label: 'Barang', value: credit.item.name },
        { label: 'Harga beli', value: rupiah(credit.purchasePrice) },
        { label: 'Harga kredit', value: rupiah(credit.creditPrice) },
        { label: 'Keuntungan', value: rupiah(credit.profit) },
        { label: 'DP', value: rupiah(credit.downPayment) },
        { label: 'Jumlah dibiayai', value: rupiah(credit.financedAmount) },
        { label: 'Tenor', value: `${credit.tenorMonths} bulan` },
        { label: 'Tanggal mulai', value: formatDate(credit.startDate) },
        { label: 'Total dibayar', value: rupiah(credit.creditPrice - v.outstanding) },
        { label: 'Sisa piutang', value: rupiah(v.outstanding) },
        { label: 'Status', value: labels[credit.status] },
      ];
      return v;
    }
  }
  if (section === 'payments') {
    v.title = 'Pembayaran';
    v.subtitle = 'Setiap penerimaan tercatat. Setiap cicilan terpantau.';
    v.columns = paymentColumns;
    v.createHref = '/payments/new';
    if (!recordId) {
      v.rows = (await paymentRows()).filter((i) => matches(i, q));
      const from = url.searchParams.get('from'),
        to = url.searchParams.get('to'),
        method = url.searchParams.get('method');
      v.rows = v.rows.filter(
        (i) =>
          (!from || i.rawDate >= from) &&
          (!to || i.rawDate <= to) &&
          (!method || i.method === labels[method]),
      );
      return v;
    }
    if (recordId === 'new') {
      const credits = await creditRows({ status: 'ACTIVE' });
      v.kind = 'form';
      v.title = 'Catat pembayaran';
      v.fields = [
        {
          name: 'creditId',
          label: 'Transaksi kredit',
          required: true,
          value: url.searchParams.get('credit') || '',
          options: credits.map((i) => ({
            value: i.id,
            label: `${i.contractNumber} · ${i.customerName} · Sisa ${rupiah(i.outstanding)}`,
          })),
        },
        { name: 'amount', label: 'Nominal pembayaran (Rp)', type: 'number', required: true },
        {
          name: 'paymentDate',
          label: 'Tanggal pembayaran',
          type: 'date',
          required: true,
          value: businessToday(),
        },
        { name: 'method', label: 'Metode pembayaran', options: methods },
        { name: 'notes', label: 'Catatan', type: 'textarea' },
      ];
      return v;
    }
    const p = await c.payments.findOne({ _id: id(recordId) });
    if (!p) throw new DomainError('NOT_FOUND', 'Pembayaran tidak ditemukan.');
    const [customer, credit, paid] = await Promise.all([
      c.customers.findOne({ _id: p.customerId }),
      c.credits.findOne({ _id: p.creditId }),
      c.payments.find({ creditId: p.creditId, createdAt: { $lte: p.createdAt } }).toArray(),
    ]);
    v.kind = 'receipt';
    v.title = 'Bukti pembayaran';
    v.subtitle = p.paymentNumber;
    v.customerName = customer!.name;
    // Sequence numbers break ties when two receipts share a millisecond.
    const total = paid
      .filter((i) => i.createdAt < p.createdAt || i.paymentNumber <= p.paymentNumber)
      .reduce((s, i) => s + i.amount, 0);
    v.details = [
      { label: 'Nomor pembayaran', value: p.paymentNumber },
      { label: 'Pelanggan', value: customer!.name },
      { label: 'Nomor kredit', value: credit!.contractNumber },
      { label: 'Barang', value: credit!.item.name },
      { label: 'Tanggal', value: formatDate(p.paymentDate) },
      { label: 'Metode', value: labels[p.method] },
      {
        label: 'Jenis pembayaran',
        value:
          p.type === 'DOWN_PAYMENT'
            ? 'Uang muka'
            : p.type === 'EARLY_SETTLEMENT'
              ? 'Pelunasan'
              : 'Cicilan',
      },
      { label: 'Nominal pembayaran', value: rupiah(p.amount) },
      {
        label: 'Total kredit saat pencatatan',
        value: rupiah(p.receiptSnapshot?.creditPrice ?? credit!.creditPrice),
      },
      {
        label: 'Total dibayar saat pencatatan',
        value: rupiah(p.receiptSnapshot?.totalPaid ?? total),
      },
      {
        label: 'Sisa saat pencatatan',
        value: rupiah(p.receiptSnapshot?.outstanding ?? credit!.creditPrice - total),
      },
    ];
    const rows = await c.installments
      .find({ _id: { $in: p.allocations.map((a) => a.installmentId) } })
      .toArray();
    v.rows = p.allocations.map((a) => ({
      id: String(a.installmentId),
      href: '',
      sequence: rows.find((i) => i._id.equals(a.installmentId))?.sequence || 0,
      amount: a.amount,
    }));
    v.columns = [
      { key: 'sequence', label: 'Cicilan ke' },
      { key: 'amount', label: 'Alokasi', money: true },
    ];
    return v;
  }
  if (section === 'reports') {
    v.kind = 'reports';
    v.title = 'Laporan usaha';
    v.subtitle = 'Ringkasan dari transaksi aktual, sesuai periode yang Anda pilih.';
    const from = url.searchParams.get('from') || businessToday().slice(0, 7) + '-01',
      to = url.searchParams.get('to') || businessToday();
    businessDate(from);
    businessDate(to);
    v.values = { from, to };
    if (recordId === 'overdue') {
      v.rows = (await installmentRows()).filter(
        (i) => i.rawDueDate < businessToday() && i.rawDueDate >= from && i.rawDueDate <= to,
      );
      v.columns = [
        { key: 'customerName', label: 'Pelanggan' },
        { key: 'contractNumber', label: 'Kredit' },
        ...installmentColumns,
      ];
      v.metrics = [
        {
          label: 'Total tunggakan',
          value: rupiah(v.rows.reduce((s, i) => s + Number(i.remaining), 0)),
          note: 'Jatuh tempo dalam periode',
        },
      ];
    } else if (recordId === 'payments') {
      v.rows = (await paymentRows()).filter((i) => i.rawDate >= from && i.rawDate <= to);
      v.columns = paymentColumns;
      v.metrics = [
        {
          label: 'Pembayaran diterima',
          value: rupiah(v.rows.reduce((s, i) => s + Number(i.amount), 0)),
          note: `${v.rows.length} transaksi, termasuk DP`,
        },
      ];
    } else {
      v.rows = (await creditRows()).filter((i) => i.startDate >= from && i.startDate <= to);
      v.columns = [
        { key: 'contractNumber', label: 'Kredit' },
        { key: 'customerName', label: 'Pelanggan' },
        { key: 'purchasePrice', label: 'Harga beli', money: true },
        { key: 'creditPrice', label: 'Harga kredit', money: true },
        { key: 'profit', label: 'Keuntungan', money: true },
      ];
      v.metrics = [
        {
          label: 'Total harga beli',
          value: rupiah(v.rows.reduce((s, i) => s + Number(i.purchasePrice), 0)),
          note: `${v.rows.length} kredit`,
        },
        {
          label: 'Total harga kredit',
          value: rupiah(v.rows.reduce((s, i) => s + Number(i.creditPrice), 0)),
          note: 'Harga aktual',
        },
        {
          label: 'Keuntungan transaksi',
          value: rupiah(v.rows.reduce((s, i) => s + Number(i.profit), 0)),
          note: 'Bukan kas yang sudah diterima',
        },
      ];
    }
    return v;
  }
  if (section === 'audit') {
    v.title = 'Riwayat aktivitas';
    v.subtitle = 'Jejak perubahan data dan transaksi.';
    v.columns = [
      { key: 'date', label: 'Waktu' },
      { key: 'action', label: 'Aktivitas' },
      { key: 'entity', label: 'Entitas' },
    ];
    v.rows = (await c.auditLogs.find({}).sort({ createdAt: -1 }).limit(100).toArray()).map((i) => ({
      id: String(i._id),
      href: '',
      date:
        formatDate(i.createdAt) +
        ' ' +
        i.createdAt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
      action: i.action,
      entity: i.entityType,
    }));
    return v;
  }
  throw new DomainError('NOT_FOUND', 'Halaman tidak ditemukan.');
}
