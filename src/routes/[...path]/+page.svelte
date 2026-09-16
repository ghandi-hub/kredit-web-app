<script lang="ts">
  import { page } from '$app/state';
  import { enhance } from '$app/forms';
  function openDialog(node: HTMLDialogElement) {
    node.showModal();
  }
  import {
    Plus,
    Search,
    ArrowLeft,
    ArrowUpRight,
    Printer,
    Pencil,
    Trash2,
    Wallet,
    X,
    MessageCircle,
  } from 'lucide-svelte';
  import type { ActionResult } from '$lib/types/ui';
  import { rupiah } from '$lib/utils/money';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import Metrics from '$lib/components/Metrics.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import EntryForm from '$lib/components/EntryForm.svelte';
  let { data, form } = $props();
  const view = $derived(data.view);
  const result = $derived(form as ActionResult | null);
  let confirm = $state(false),
    pending = $state(false);
  const installmentColumns = [
    { key: 'sequence', label: '#' },
    { key: 'dueDate', label: 'Jatuh tempo' },
    { key: 'amount', label: 'Nominal', money: true },
    { key: 'paidAmount', label: 'Dibayar', money: true },
    { key: 'remaining', label: 'Sisa', money: true },
    { key: 'status', label: 'Status' },
  ];
  function whatsapp() {
    const due = view.installments.find((i) => Number(i.remaining) > 0);
    const phone = view.customerPhone.replace(/\D/g, '').replace(/^0/, '62');
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Halo Bapak/Ibu ${view.customerName}, kami mengingatkan cicilan ${view.subtitle} sebesar ${rupiah(Number(due?.remaining || 0))}, jatuh tempo ${due?.dueDate || ''}. Terima kasih.`)}`;
  }
</script>

<svelte:head><title>{view.title} — Kredit.</title></svelte:head>
{#if view.kind === 'dashboard'}<Dashboard {view} />{:else}
  <div class="page-heading">
    <div>
      {#if view.kind === 'detail' || view.kind === 'form' || view.kind === 'receipt'}<a
          href={`/${view.section}`}
          class="back-link"
          ><ArrowLeft size={14} />Kembali ke {view.section === 'credits'
            ? 'kredit'
            : view.section === 'customers'
              ? 'pelanggan'
              : 'pembayaran'}</a
        >{:else}<div class="eyebrow">
          RUANG KERJA / {view.section === 'reports' ? 'LAPORAN' : 'PENCATATAN'}
        </div>{/if}
      <h1>{view.title}<span class="lime-dot">.</span></h1>
      <p>{view.subtitle}</p>
    </div>
    <div class="button-group no-print">
      {#if view.kind === 'list' && view.createHref}<a class="button primary" href={view.createHref}
          ><Plus size={18} />{view.section === 'credits'
            ? 'Buat kredit'
            : view.section === 'payments'
              ? 'Catat pembayaran'
              : 'Tambah pelanggan'}</a
        >{/if}{#if view.editHref}<a class="button" href={view.editHref}><Pencil size={16} />Edit</a
        >{/if}{#if view.canPay}<a class="button primary" href={view.paymentHref}
          ><Wallet size={17} />Catat pembayaran</a
        >{/if}{#if view.kind === 'receipt'}<button
          class="button primary"
          onclick={() => window.print()}><Printer size={17} />Cetak / Simpan PDF</button
        >{/if}
    </div>
  </div>
  {#if view.kind === 'form'}{#key page.url.pathname}<EntryForm {view} {result} />{/key}
  {:else}
    {#if result?.message}<div class="alert" role="alert">{result.message}</div>{/if}
    {#if view.kind === 'reports'}<nav class="report-tabs no-print">
        <a
          class:chosen={!page.url.pathname.endsWith('payments') &&
            !page.url.pathname.endsWith('overdue')}
          href="/reports/profit">Keuntungan</a
        ><a class:chosen={page.url.pathname.endsWith('payments')} href="/reports/payments"
          >Pembayaran</a
        ><a class:chosen={page.url.pathname.endsWith('overdue')} href="/reports/overdue"
          >Tunggakan</a
        >
      </nav>
      <form class="filters no-print">
        <div class="field">
          <label for="from">Dari tanggal</label><input
            type="date"
            name="from"
            id="from"
            value={view.values.from}
          />
        </div>
        <div class="field">
          <label for="to">Sampai tanggal</label><input
            type="date"
            name="to"
            id="to"
            value={view.values.to}
          />
        </div>
        <button class="button primary">Tampilkan laporan</button><button
          type="button"
          class="button"
          onclick={() => window.print()}><Printer size={16} />Cetak</button
        >
      </form>{/if}
    {#if view.metrics.length}<Metrics metrics={view.metrics} />{/if}
    {#if view.details.length}<section
        class="panel detail-panel"
        class:receipt={view.kind === 'receipt'}
      >
        {#if view.kind === 'receipt'}<div class="receipt-brand">
            KREDIT. <span>BUKTI PEMBAYARAN</span>
          </div>{/if}
        <dl class="detail-grid">
          {#each view.details as item}<div>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>{/each}
        </dl>
        {#if view.ktpHref}<a
            class="button no-print"
            href={view.ktpHref}
            target="_blank"
            rel="noreferrer">Lihat foto KTP<ArrowUpRight size={16} /></a
          >{/if}{#if view.canPay}<a
            class="button no-print"
            href={whatsapp()}
            target="_blank"
            rel="noreferrer"><MessageCircle size={16} />Buka pengingat WhatsApp</a
          >{/if}
      </section>{/if}
    {#if view.kind === 'list'}<form class="filters">
        <div class="search-input">
          <Search size={18} /><input
            name="q"
            aria-label="Pencarian"
            placeholder={view.section === 'customers'
              ? 'Cari nama, NIK, atau nomor telepon…'
              : view.section === 'credits'
                ? 'Cari nomor kredit, pelanggan, atau barang…'
                : 'Cari transaksi atau nama…'}
            value={page.url.searchParams.get('q') || ''}
          />
        </div>
        {#if view.section === 'credits'}<select name="status" aria-label="Filter status"
            ><option value="">Semua status</option><option
              value="ACTIVE"
              selected={page.url.searchParams.get('status') === 'ACTIVE'}>Aktif</option
            ><option value="PAID" selected={page.url.searchParams.get('status') === 'PAID'}
              >Lunas</option
            ><option value="OVERDUE" selected={page.url.searchParams.get('status') === 'OVERDUE'}
              >Terlambat</option
            ></select
          >{/if}{#if view.section === 'payments'}<input
            type="date"
            name="from"
            aria-label="Dari tanggal"
            value={page.url.searchParams.get('from') || ''}
          /><input
            type="date"
            name="to"
            aria-label="Sampai tanggal"
            value={page.url.searchParams.get('to') || ''}
          /><select name="method" aria-label="Metode pembayaran"
            ><option value="">Semua metode</option><option value="CASH">Tunai</option><option
              value="TRANSFER">Transfer</option
            ><option value="OTHER">Lainnya</option></select
          >{/if}<button class="button">Cari</button>{#if page.url.search}<a
            class="text-link"
            href={page.url.pathname}>Reset</a
          >{/if}
      </form>{/if}
    {#if view.kind === 'detail' && view.section === 'credits'}<section class="panel">
        <div class="panel-heading">
          <h2>Jadwal cicilan</h2>
          <span class="eyebrow">{view.installments.length} BULAN</span>
        </div>
        <DataTable columns={installmentColumns} rows={view.installments} />
      </section>{:else if view.columns.length}<section class="panel">
        {#if view.kind === 'detail'}<div class="panel-heading">
            <h2>Riwayat kredit</h2>
          </div>{:else if view.kind === 'receipt'}<div class="panel-heading">
            <h2>Alokasi pembayaran</h2>
          </div>{/if}<DataTable
          columns={view.columns}
          rows={view.rows}
          empty={view.kind === 'receipt'
            ? 'Uang muka tidak dialokasikan ke cicilan.'
            : page.url.searchParams.get('q')
              ? 'Tidak ada hasil yang cocok.'
              : 'Belum ada data tercatat.'}
        />
      </section>{/if}
    {#if view.kind === 'detail' && (view.section === 'credits' || view.section === 'customers')}<section
        class="panel"
      >
        <div class="panel-heading"><h2>Riwayat pembayaran</h2></div>
        <DataTable
          columns={[
            { key: 'paymentNumber', label: 'No. pembayaran' },
            { key: 'paymentDate', label: 'Tanggal' },
            { key: 'amount', label: 'Nominal', money: true },
            { key: 'method', label: 'Metode' },
          ]}
          rows={view.payments}
          empty="Belum ada pembayaran tercatat."
        />
      </section>{/if}
    {#if view.canDelete}<div class="danger-zone no-print">
        <div>
          <strong>{view.section === 'credits' ? 'Batalkan transaksi kredit' : 'Hapus data'}</strong>
          <p>
            {view.section === 'credits'
              ? 'Kredit, seluruh cicilan, dan riwayat pembayaran akan dihapus.'
              : 'Data yang sudah digunakan dalam kredit tidak dapat dihapus.'}
          </p>
        </div>
        <button class="button danger" onclick={() => (confirm = true)}
          ><Trash2 size={16} />Hapus {view.section === 'credits' ? 'kredit' : 'data'}</button
        >
      </div>{/if}
  {/if}{/if}
{#if confirm}
  <dialog
    class="modal"
    aria-labelledby="delete-title"
    use:openDialog
    oncancel={() => (confirm = false)}
  >
    <div class="panel-heading">
      <h2 id="delete-title">Hapus {view.title}?</h2>
      <button class="icon-button" aria-label="Tutup konfirmasi" onclick={() => (confirm = false)}
        ><X size={20} /></button
      >
    </div>
    <p>
      {view.section === 'credits'
        ? 'Kredit, jadwal cicilan, dan seluruh pembayaran terkait akan dihapus secara permanen.'
        : 'Data ini akan dihapus secara permanen jika tidak memiliki referensi kredit.'} Tindakan ini
      tidak dapat dibatalkan.
    </p>
    <form
      method="POST"
      action="?/delete"
      use:enhance={() => {
        pending = true;
        return async ({ update }) => {
          await update();
          pending = false;
          confirm = false;
        };
      }}
    >
      <input type="hidden" name="confirmation" value={view.recordId} />
      <div class="button-group">
        <button type="button" class="button" onclick={() => (confirm = false)}>Batal</button><button
          class="button danger"
          disabled={pending}>{pending ? 'Menghapus…' : 'Ya, hapus permanen'}</button
        >
      </div>
    </form>
  </dialog>
{/if}
