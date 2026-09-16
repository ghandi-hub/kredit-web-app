<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import { ArrowUpRight, ArrowRight, LockKeyhole, Eye, EyeOff, Check } from 'lucide-svelte';
  let { data, form } = $props();
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });
  let pending = $state(false),
    show = $state(false);
</script>

<svelte:head
  ><title>Masuk — Kredit.</title><meta
    name="description"
    content="Kelola kredit barang, pelanggan, dan cicilan dalam satu tempat."
  /></svelte:head
>
<div class="login-page">
  <section class="login-story">
    <a href="/login" class="brand"><span class="brand-mark">k</span>KREDIT.</a>
    <div class="story-content">
      <div class="eyebrow">CATAT. PANTAU. TUMBUH.</div>
      <h1>Usaha rapi.<br />Piutang<br /><span>terkendali.</span></h1>
      <p>Kelola kredit barang dan cicilan pelanggan<br />dalam satu ruang kerja yang sederhana.</p>
      <div class="story-art" aria-hidden="true">
        <div class="art-tag">SEMUA TERCATAT <ArrowUpRight size={24} /></div>
        <div class="art-sheet">
          <div class="art-sheet-title">CATATAN USAHA<span>↗</span></div>
          <div class="art-line"><Check size={18} />Pelanggan terdata</div>
          <div class="art-line"><Check size={18} />Cicilan terjadwal</div>
          <div class="art-line"><Check size={18} />Pembayaran terpantau</div>
          <div class="art-bottom">LEBIH TENANG. LEBIH TERATUR.</div>
        </div>
        <div class="art-star">✳</div>
      </div>
    </div>
    <div class="eyebrow">DIBUAT UNTUK PEMILIK USAHA.</div>
  </section>
  <section class="login-form-side">
    <div class="login-top">SISTEM MANAJEMEN KREDIT <ArrowUpRight size={18} /></div>
    <div class="login-form">
      <span class="login-icon"><LockKeyhole size={25} /></span>
      <div class="eyebrow">SELAMAT DATANG KEMBALI</div>
      <h2>Masuk ke ruang kerja.</h2>
      <p class="muted">Semua catatan usaha Anda, siap dilanjutkan.</p>
      {#if !data.configured}<div class="alert setup">
          <strong>Konfigurasi awal diperlukan</strong>
          <p>
            Isi koneksi MongoDB dan SESSION_SECRET pada berkas .env, lalu jalankan <code
              >npm run db:seed</code
            > untuk membuat akun pemilik.
          </p>
        </div>{/if}
      <form
        method="POST"
        use:enhance={() => {
          pending = true;
          return async ({ update }) => {
            await update({ reset: false });
            pending = false;
          };
        }}
      >
        {#if form?.message}<div class="alert" role="alert">{form.message}</div>{/if}
        <div class="field">
          <label for="username">Nama pengguna</label><input
            id="username"
            name="username"
            autocomplete="username"
            required
            placeholder="Masukkan nama pengguna"
            value={form?.username || ''}
          />
        </div>
        <div class="field">
          <label for="password">Kata sandi</label>
          <div class="password-wrap">
            <input
              id="password"
              name="password"
              type={show ? 'text' : 'password'}
              autocomplete="current-password"
              required
              placeholder="Masukkan kata sandi"
            /><button
              type="button"
              class="icon-button"
              onclick={() => (show = !show)}
              disabled={!ready}
              aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >{#if show}<EyeOff size={18} />{:else}<Eye size={18} />{/if}</button
            >
          </div>
        </div>
        <button class="button primary login-submit" disabled={pending || !data.configured}
          >{pending ? 'Memeriksa akun…' : 'Masuk'}<ArrowRight size={19} /></button
        >
      </form>
      <div class="login-security">
        <LockKeyhole size={15} /><span>Akses khusus pemilik. Data Anda tersimpan privat.</span>
      </div>
    </div>
    <div class="login-bottom">
      <span>KREDIT. © {new Date().getFullYear()}</span><span>Usaha Anda, dalam kendali.</span>
    </div>
  </section>
</div>
