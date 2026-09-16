<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="error-page">
  <span class="eyebrow">{page.status}</span>
  <h1>{page.status === 404 ? 'Halaman tidak ditemukan.' : 'Halaman belum dapat dimuat.'}</h1>
  <p>{page.error?.message}</p>
  <a class="button primary" href="/dashboard">Kembali ke dashboard</a>
</div>
