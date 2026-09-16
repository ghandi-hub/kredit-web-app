<script lang="ts">
  import { ArrowUpRight } from 'lucide-svelte';
  let { metrics }: { metrics: { label: string; value: string; note: string }[] } = $props();
</script>

<div class="metrics">
  {#each metrics as metric, i}<article class="metric" class:lime={i === 0}>
      <div class="metric-label">{metric.label}<ArrowUpRight size={18} /></div>
      <strong>{metric.value}</strong>
      <div class="metric-note"><span class="tiny-dot"></span>{metric.note}</div>
    </article>{/each}
</div>
