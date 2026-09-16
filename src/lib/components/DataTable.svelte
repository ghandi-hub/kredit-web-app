<script lang="ts">
  import { ArrowUpRight, Inbox } from 'lucide-svelte';
  import { rupiah } from '$lib/utils/money';
  import type { Column, Row } from '$lib/types/ui';
  let {
    columns,
    rows,
    empty = 'Belum ada data.',
    pageSize = 20,
  }: { columns: Column[]; rows: Row[]; empty?: string; pageSize?: number } = $props();
  let current = $state(1);
  const total = $derived(Math.max(1, Math.ceil(rows.length / pageSize)));
  const active = $derived(Math.min(current, total));
</script>

<div class="table-wrap">
  <table>
    <thead
      ><tr
        >{#each columns as col}<th class:align-right={col.money}>{col.label}</th>{/each}<th
          ><span class="sr-only">Detail</span></th
        ></tr
      ></thead
    >
    <tbody
      >{#each rows.slice((active - 1) * pageSize, active * pageSize) as row}<tr
          >{#each columns as col}<td class:align-right={col.money} class:tabular={col.money}
              >{#if col.key === 'status'}<span
                  class="badge"
                  class:green={row[col.key] === 'Lunas' || row[col.key] === 'Aktif'}
                  class:orange={row[col.key] === 'Terlambat'}
                  class:purple={row[col.key] === 'Sebagian'}>{row[col.key]}</span
                >{:else if col.money}{rupiah(
                  Number(row[col.key]),
                )}{:else if col === columns[0] && row.href}<a class="table-link" href={row.href}
                  >{row[col.key]}</a
                >{:else}{row[col.key] ?? '—'}{/if}</td
            >{/each}<td
            >{#if row.href}<a
                class="icon-button"
                href={row.href}
                aria-label={`Lihat detail ${row[columns[0].key]}`}><ArrowUpRight size={16} /></a
              >{/if}</td
          ></tr
        >{/each}</tbody
    >
  </table>
  {#if !rows.length}<div class="empty-state">
      <Inbox size={32} strokeWidth={1.5} /><strong>{empty}</strong>
      <p>Data akan tampil di sini setelah dicatat.</p>
    </div>{/if}
</div>
{#if rows.length > pageSize}<div class="pagination">
    <span>{rows.length} data · Halaman {active} dari {total}</span>
    <div>
      <button class="button small" disabled={active === 1} onclick={() => (current = active - 1)}
        >Sebelumnya</button
      ><button
        class="button small"
        disabled={active === total}
        onclick={() => (current = active + 1)}>Berikutnya</button
      >
    </div>
  </div>{/if}
