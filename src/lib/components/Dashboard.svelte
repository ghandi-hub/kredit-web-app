<script lang="ts">
  import {
    ArrowUpRight,
    Plus,
    Wallet,
    CalendarDays,
    ArrowRight,
    CircleAlert,
    Check,
    Users,
    Send,
  } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import { businessToday, formatDate } from '$lib/utils/dates';
  import { rupiah } from '$lib/utils/money';
  import type { ActionResult, AppView } from '$lib/types/ui';
  import Metrics from './Metrics.svelte';
  import DataTable from './DataTable.svelte';
  let { view, result }: { view: AppView; result?: ActionResult | null } = $props();
  let tab = $state('today'),
    pendingBackup = $state(false);
  const today = businessToday();
  const due = $derived(
    view.installments.filter((i) =>
      tab === 'today'
        ? i.rawDueDate === today
        : tab === 'overdue'
          ? i.rawDueDate < today
          : i.rawDueDate > today,
    ),
  );
</script>

<div class="page-heading">
  <div>
    <div class="eyebrow">RINGKASAN USAHA</div>
    <h1>Usaha Anda, dalam kendali<span class="lime-dot">.</span></h1>
    <p>{view.subtitle}</p>
  </div>
  <div class="date-chip"><CalendarDays size={17} />{formatDate(new Date())}</div>
</div>
{#if result?.message}
  <div class="alert {result.success ? 'success' : ''}" role="alert">
    <div style="display:flex;align-items:center;gap:10px;">
      {#if result.success}
        <Check size={18} />
      {:else}
        <CircleAlert size={18} />
      {/if}
      <span>{result.message}</span>
    </div>
  </div>
{/if}
{#if view.backupStatus?.needsBackup}
  <div class="backup-alert-banner">
    <div class="backup-alert-info">
      <div class="backup-badge"><CircleAlert size={15} /> PERLU CADANGAN DATABASE</div>
      <p>
        {#if view.backupStatus.lastBackupAt}
          Database belum dicadangkan selama <strong>{view.backupStatus.daysAgo} hari</strong>
          (terakhir:
          {view.backupStatus.lastBackupAt}).
        {:else}
          Database <strong>belum pernah dicadangkan</strong> ke Telegram.
        {/if}
        Cadangkan data sekarang agar data transaksi Anda selalu aman.
      </p>
    </div>
    <form
      method="POST"
      action="?/backup"
      use:enhance={() => {
        pendingBackup = true;
        return async ({ update }) => {
          await update();
          pendingBackup = false;
        };
      }}
    >
      <button class="button primary" disabled={pendingBackup}>
        <Send size={15} />
        {pendingBackup ? 'Mengirim ke Telegram…' : 'Cadangkan ke Telegram'}
      </button>
    </form>
  </div>
{/if}
<div class="dashboard-actions">
  <div class="live-label"><span class="tiny-dot"></span>DATA TRANSAKSI TERKINI</div>
  <div class="button-group">
    <a class="button" href="/payments/new"><Wallet size={17} />Catat pembayaran</a><a
      class="button primary"
      href="/credits/new"><Plus size={18} />Buat kredit</a
    >
  </div>
</div>
<Metrics metrics={view.metrics} />
<div class="dashboard-grid">
  <section class="panel due-panel">
    <div class="panel-heading">
      <div>
        <h2>Jadwal penagihan <span class="count-badge">{view.installments.length}</span></h2>
        <p>Prioritaskan cicilan yang perlu ditindaklanjuti.</p>
      </div>
      <a class="text-link" href="/reports/overdue">Lihat semua<ArrowUpRight size={16} /></a>
    </div>
    <div class="tabs">
      <button class:chosen={tab === 'today'} onclick={() => (tab = 'today')}
        >Hari ini <span>{view.installments.filter((i) => i.rawDueDate === today).length}</span
        ></button
      ><button class:chosen={tab === 'overdue'} onclick={() => (tab = 'overdue')}
        >Terlambat <span>{view.installments.filter((i) => i.rawDueDate < today).length}</span
        ></button
      ><button class:chosen={tab === 'upcoming'} onclick={() => (tab = 'upcoming')}
        >Mendatang</button
      >
    </div>
    <DataTable
      columns={[
        { key: 'customerName', label: 'Pelanggan' },
        { key: 'contractNumber', label: 'No. kredit' },
        { key: 'remaining', label: 'Tagihan', money: true },
        { key: 'dueDate', label: 'Jatuh tempo' },
        { key: 'status', label: 'Status' },
      ]}
      rows={due}
      empty={tab === 'today'
        ? 'Tidak ada tagihan jatuh tempo hari ini.'
        : tab === 'overdue'
          ? 'Tidak ada cicilan terlambat.'
          : 'Belum ada jadwal cicilan mendatang.'}
      pageSize={5}
    />
  </section>
  <aside class="dashboard-aside">
    <section class="attention-card">
      <div class="eyebrow"><CircleAlert size={17} />PERLU PERHATIAN</div>
      <h3>Piutang terlambat</h3>
      <strong>{rupiah(view.outstanding)}</strong>
      <p>
        {view.installments.filter((i) => i.rawDueDate < today).length} cicilan melewati jatuh tempo.<br
        />Tagihan tetap, tanpa denda.
      </p>
      <a class="button dark" href="/reports/overdue">Tinjau tunggakan<ArrowUpRight size={17} /></a>
    </section>
    <section class="quick-links">
      <div class="eyebrow">AKSES CEPAT</div>
      <a href="/customers/new"><span><Users size={17} />Tambah pelanggan</span><Plus size={17} /></a
      ><a href="/reports"
        ><span><ArrowUpRight size={17} />Lihat laporan usaha</span><ArrowRight size={17} /></a
      >
    </section>
    <!-- <section class="panel backup-card">
      <div class="eyebrow">
        <span
          class="tiny-dot"
          class:warning-dot={view.backupStatus?.needsBackup}
          class:success-dot={!view.backupStatus?.needsBackup}
        ></span>
        {view.backupStatus?.needsBackup ? 'PERLU CADANGAN' : 'CADANGAN AMAN'}
      </div>
      <h3>Cadangan Telegram</h3>
      <p>
        {#if view.backupStatus?.lastBackupAt}
          Terakhir: <strong>{view.backupStatus.lastBackupAt}</strong>
          <small
            >({view.backupStatus.daysAgo === 0
              ? 'Hari ini'
              : `${view.backupStatus.daysAgo} hari lalu`})</small
          >
        {:else}
          Belum pernah dicadangkan ke Telegram.
        {/if}
      </p>
      <form
        method="POST"
        action="?/backup"
        use:enhance={() => {
          pendingBackup = true;
          return async ({ update }) => {
            await update();
            pendingBackup = false;
          };
        }}
      >
        <button
          class="button {view.backupStatus?.needsBackup ? 'primary' : ''}"
          style="width: 100%; justify-content: space-between;"
          disabled={pendingBackup}
        >
          <span>{pendingBackup ? 'Mengirim…' : 'Kirim Backup Manual'}</span>
          <Send size={14} />
        </button>
      </form>
    </section> -->
  </aside>
</div>
<section class="panel recent-panel">
  <div class="panel-heading">
    <div>
      <h2>Pembayaran terbaru</h2>
      <p>Penerimaan terakhir yang tercatat di usaha Anda.</p>
    </div>
    <a class="text-link" href="/payments">Semua pembayaran<ArrowUpRight size={16} /></a>
  </div>
  <DataTable
    columns={[
      { key: 'paymentNumber', label: 'No. pembayaran' },
      { key: 'customerName', label: 'Pelanggan' },
      { key: 'contractNumber', label: 'No. kredit' },
      { key: 'paymentDate', label: 'Tanggal' },
      { key: 'method', label: 'Metode' },
      { key: 'amount', label: 'Nominal', money: true },
    ]}
    rows={view.payments}
    empty="Belum ada pembayaran tercatat."
  />
</section>
<div class="dashboard-footnote">
  <Check size={15} /><span>Ringkasan dihitung dari transaksi aktual.</span
  >{#each view.details as detail}<span class="footnote-detail"
      >{detail.label}: <strong>{detail.value}</strong></span
    >{/each}
</div>
