<script lang="ts">
  import '../app.css';
  import { page, navigating } from '$app/state';
  import {
    LayoutDashboard,
    Users,
    Files,
    Wallet,
    ChartNoAxesCombined,
    History,
    ArrowUpRight,
    LogOut,
    Menu,
    X,
    Search,
  } from 'lucide-svelte';
  let { data, children } = $props();
  let mobile = $state(false);
  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/customers', label: 'Pelanggan', icon: Users },
    { href: '/credits', label: 'Transaksi kredit', icon: Files },
    { href: '/payments', label: 'Pembayaran', icon: Wallet },
    { href: '/reports', label: 'Laporan', icon: ChartNoAxesCombined },
  ];

  $effect(() => {
    if (mobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && mobile) mobile = false;
  }}
  onresize={() => {
    if (window.innerWidth > 760 && mobile) mobile = false;
  }}
  onpopstate={() => (mobile = false)}
/>

{#if data.user}<div class="app-shell">
    {#if mobile}
      <button
        type="button"
        class="sidebar-backdrop"
        onclick={() => (mobile = false)}
        aria-label="Tutup menu samping"
        tabindex="-1"
      ></button>
    {/if}
    <aside class="sidebar" class:open={mobile}>
      <div class="sidebar-header">
        <a href="/dashboard" class="brand" onclick={() => (mobile = false)}
          ><span class="brand-mark">k</span>KREDIT<span class="brand-dot">.</span></a
        >
        <button
          type="button"
          class="icon-button sidebar-close"
          onclick={() => (mobile = false)}
          aria-label="Tutup menu"
        >
          <X size={20} />
        </button>
      </div>
      <div class="workspace-label"><span class="tiny-dot"></span> RUANG KERJA PEMILIK</div>
      <div class="nav-label">MENU UTAMA</div>
      <nav>
        {#each links as link}
          {@const isPending = Boolean(navigating.to?.url.pathname.startsWith(link.href))}
          <a
            href={link.href}
            class:active={page.url.pathname.startsWith(link.href)}
            class:nav-pending={isPending}
            onclick={() => (mobile = false)}
          >
            <link.icon size={19} />
            <span>{link.label}</span>
          </a>
        {/each}
      </nav>
      <div class="sidebar-bottom">
        <a
          class="activity-link"
          class:nav-pending={Boolean(navigating.to?.url.pathname.startsWith('/audit'))}
          href="/audit"
          onclick={() => (mobile = false)}
        >
          <History size={18} />
          <span>Riwayat aktivitas</span>
          {#if navigating.to?.url.pathname.startsWith('/audit')}
            <span class="menu-spinner" aria-label="Memuat"></span>
          {/if}
        </a>
        <div class="sidebar-note">
          <span class="eyebrow">USAHA LEBIH TERTATA</span>
          <p>Satu tempat untuk<br />setiap cicilan.</p>
          <span class="note-arrow">↗</span>
        </div>
        <div class="profile">
          <span class="avatar">{data.user.name.charAt(0).toUpperCase()}</span>
          <div><strong>{data.user.name}</strong><small>Pemilik usaha</small></div>
          <form method="POST" action="/logout">
            <button class="icon-button" aria-label="Keluar"><LogOut size={18} /></button>
          </form>
        </div>
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="icon-button mobile-menu"
            onclick={() => (mobile = !mobile)}
            aria-label={mobile ? 'Tutup menu' : 'Buka menu'}
            >{#if mobile}<X size={20} />{:else}<Menu size={20} />{/if}</button
          ><span>Ruang kerja</span><span class="slash">/</span><strong
            >{links.find((l) => page.url.pathname.startsWith(l.href))?.label ||
              (page.url.pathname === '/search' ? 'Hasil pencarian' : 'Riwayat aktivitas')}</strong
          >
          {#if navigating.to}
            <span class="topbar-loading-indicator" role="status" aria-live="polite">
              <span class="spinner-dot"></span>
              <span>Memuat...</span>
            </span>
          {/if}
        </div>
        <div class="topbar-right">
          <form class="global-search" action="/search">
            <Search size={16} /><input
              name="q"
              placeholder="Cari pelanggan atau transaksi…"
              aria-label="Pencarian global"
            />
          </form>
          <span class="owner-badge"><span class="tiny-dot"></span>Admin</span>
        </div>
      </header>
      {#if navigating.to}
        <div class="loading-bar" role="status" aria-label="Memuat halaman">
          <div class="loading-bar-inner"></div>
        </div>
      {/if}
      <main class="content" class:content-loading={Boolean(navigating.to)}>
        {#if navigating.to}
          <div
            class="page-loading-cover"
            role="status"
            aria-live="polite"
            aria-label="Memuat data halaman"
          >
            <div class="loading-badge">
              <span class="spinner"></span>
              <div class="loading-badge-text">
                <strong>Memuat data…</strong>
                <span>Menghubungi server</span>
              </div>
            </div>
          </div>
        {/if}
        {@render children()}
      </main>
      <footer class="app-footer">
        <span>KREDIT. / SISTEM MANAJEMEN KREDIT BARANG</span><span
          >Rapi dicatat. Mudah dipantau.</span
        >
      </footer>
    </div>
  </div>{:else}{#if navigating.to}
    <div class="loading-bar" role="status" aria-label="Memuat halaman">
      <div class="loading-bar-inner"></div>
    </div>
  {/if}{@render children()}{/if}
