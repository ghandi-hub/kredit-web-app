<script lang="ts">
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import { ArrowLeft, ArrowRight, Calculator, LockKeyhole, Upload } from 'lucide-svelte';
  import { formatDate } from '$lib/utils/dates';
  import { rupiah } from '$lib/utils/money';
  import type { AppView, ActionResult } from '$lib/types/ui';
  let { view, result }: { view: AppView; result: ActionResult | null } = $props();
  let pending = $state(false);
  let values = $state<Record<string, string>>(
    untrack(() =>
      Object.fromEntries(
        view.fields
          .filter((f) => f.type !== 'file')
          .map((f) => [
            f.name,
            result?.values?.[f.name] ??
              view.values[f.name] ??
              String(f.value ?? f.options?.[0]?.value ?? ''),
          ]),
      ),
    ),
  );
  const requestId = untrack(() => result?.values?.requestId ?? view.requestId);
  let changed = $state(false);
</script>

<div class="form-layout">
  <section class="panel form-panel">
    <div class="panel-heading">
      <h2>
        Informasi {view.section === 'credits'
          ? 'kredit'
          : view.section === 'payments'
            ? 'pembayaran'
            : 'pelanggan'}
      </h2>
      <span class="eyebrow">* WAJIB DIISI</span>
    </div>
    {#if view.locked}<div class="alert">
        Kredit sudah memiliki pembayaran cicilan. Nominal dan jadwal terkunci.
      </div>{/if}
    <form
      method="POST"
      action="?/save"
      enctype="multipart/form-data"
      oninput={() => (changed = true)}
      use:enhance={() => {
        pending = true;
        return async ({ update }) => {
          await update({ reset: false });
          pending = false;
          changed = false;
        };
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      {#if result?.message}<div class="alert" role="alert">{result.message}</div>{/if}
      <div class="form-grid">
        {#each view.fields as field}<div
            class:wide={field.type === 'textarea' || field.type === 'file'}
            class="field"
          >
            <label for={field.name}>{field.label}{field.required ? ' *' : ''}</label>
            {#if field.options}{#if field.readonly}<input
                  type="hidden"
                  name={field.name}
                  value={values[field.name]}
                />{/if}<select
                id={field.name}
                name={field.name}
                bind:value={values[field.name]}
                required={field.required}
                disabled={field.readonly || view.locked}
                aria-invalid={!!result?.fields?.[field.name]}
                ><option value="" disabled selected>Pilih {field.label.toLowerCase()}</option
                >{#each field.options as option}<option value={option.value}>{option.label}</option
                  >{/each}</select
              >
            {:else if field.type === 'textarea'}<textarea
                id={field.name}
                name={field.name}
                bind:value={values[field.name]}
                rows="3"
                required={field.required}
                disabled={view.locked}
              ></textarea>
            {:else if field.type === 'file'}<div class="upload">
                <Upload size={24} /><input
                  id={field.name}
                  name={field.name}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required={!view.values.name}
                />
              </div>
            {:else}<input
                id={field.name}
                name={field.name}
                type={field.type || 'text'}
                bind:value={values[field.name]}
                required={field.required}
                readonly={field.readonly}
                disabled={view.locked}
                min={field.type === 'number' ? 0 : undefined}
                step={field.type === 'number' ? 1 : undefined}
                aria-invalid={!!result?.fields?.[field.name]}
              />{/if}
            {#if field.help}<small>{field.help}</small>{/if}{#if result?.fields?.[field.name]}<small
                class="field-error">{result.fields[field.name]}</small
              >{/if}
          </div>{/each}
      </div>
      <div class="form-footer">
        <a class="button" href={`/${view.section}`}><ArrowLeft size={16} />Batal</a>
        <div class="button-group">
          {#if view.section === 'credits' || view.section === 'payments'}<button
              class="button"
              formaction="?/preview"
              disabled={pending || view.locked}><Calculator size={16} />Pratinjau</button
            >{/if}<button class="button primary" disabled={pending || view.locked}
            >{pending ? 'Memproses…' : 'Simpan'}<ArrowRight size={16} /></button
          >
        </div>
      </div>
    </form>
  </section>
  <aside class="form-aside">
    <div class="note-card lime">
      <span class="eyebrow">CATATAN PENCATATAN</span>
      <h3>
        {view.section === 'payments'
          ? 'Satu pembayaran, banyak kemungkinan.'
          : view.section === 'credits'
            ? 'Jadwal rapi sejak awal.'
            : 'Data lengkap, usaha tertata.'}
      </h3>
      <p>
        {view.section === 'payments'
          ? 'Bayar sebagian, beberapa cicilan, atau lunasi sekaligus. Pembayaran dialokasikan ke cicilan paling awal yang belum lunas.'
          : view.section === 'credits'
            ? 'Harga kredit otomatis menggunakan markup 40%. Anda dapat menentukan harga sendiri, minimal sama dengan harga beli.'
            : 'Pastikan identitas dan nomor telepon sesuai sebelum menyimpan data.'}
      </p>
      <div class="note-divider"></div>
      <LockKeyhole size={18} />
      <p class="small-text">
        {view.section === 'payments'
          ? 'Pembayaran yang sudah tercatat tidak dapat diedit. Periksa nominal sebelum menyimpan.'
          : view.section === 'credits'
            ? 'Nominal dan jadwal dapat diedit sebelum ada pembayaran cicilan. DP yang sudah tercatat tetap dipertahankan.'
            : 'Data hanya dapat diakses oleh pemilik yang sudah masuk.'}
      </p>
    </div>
    {#if result?.schedule && !changed}<div class="panel preview">
        <h3>Pratinjau {view.section === 'payments' ? 'alokasi' : 'cicilan'}</h3>
        {#each result.preview || [] as item}<div class="summary-line">
            <span>{item.label}</span><strong>{item.value}</strong>
          </div>{/each}{#each result.schedule as i}<div class="summary-line">
            <span>#{i.sequence}{i.dueDate ? ' · ' + formatDate(i.dueDate) : ''}</span><strong
              >{rupiah(i.amount)}</strong
            >
          </div>{/each}<small
          >Hasil dihitung di server. Saldo diperiksa kembali saat disimpan.</small
        >
      </div>{/if}
  </aside>
</div>
