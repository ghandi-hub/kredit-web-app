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
</script>

{#if data.user}<div class="app-shell">
    <aside class="sidebar" class:open={mobile}>
      <a href="/dashboard" class="brand" onclick={() => (mobile = false)}
        ><span class="brand-mark">k</span>KREDIT<span class="brand-dot">.</span></a
      >
      <div class="workspace-label"><span class="tiny-dot"></span> RUANG KERJA PEMILIK</div>
      <div class="nav-label">MENU UTAMA</div>
      <nav>
        {#each links as link}<a
            href={link.href}
            class:active={page.url.pathname.startsWith(link.href)}
            onclick={() => (mobile = false)}
            ><link.icon size={19} /><span>{link.label}</span
            >{#if page.url.pathname.startsWith(link.href)}<ArrowUpRight size={16} />{/if}</a
          >{/each}
      </nav>
      <div class="sidebar-bottom">
        <a class="activity-link" href="/audit"><History size={18} />Riwayat aktivitas</a>
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
            aria-label="Buka menu"
            >{#if mobile}<X size={20} />{:else}<Menu size={20} />{/if}</button
          ><span>Ruang kerja</span><span class="slash">/</span><strong
            >{links.find((l) => page.url.pathname.startsWith(l.href))?.label ||
              (page.url.pathname === '/search' ? 'Hasil pencarian' : 'Riwayat aktivitas')}</strong
          >
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
      {#if navigating.to}<div
          class="loading-bar"
          role="status"
          aria-label="Memuat halaman"
        ></div>{/if}
      <main class="content">{@render children()}</main>
      <footer class="app-footer">
        <span>KREDIT. / SISTEM MANAJEMEN KREDIT BARANG</span><span
          >Rapi dicatat. Mudah dipantau.</span
        >
      </footer>
    </div>
  </div>{:else}{@render children()}{/if}
