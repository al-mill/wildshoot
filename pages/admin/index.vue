<template>
  <div>
    <h1 class="page-title">Dashboard</h1>

    <div v-if="admin.isLoading" class="loading">Loading…</div>

    <template v-else-if="admin.stats">
      <div class="stats-grid">
        <AdminStatsCard label="Total Users" :value="admin.stats.totalUsers" />
        <AdminStatsCard label="Total Photos" :value="admin.stats.totalPhotos" />
        <AdminStatsCard
          label="Unique Locations"
          :value="admin.stats.totalLocations"
        />
      </div>

      <section class="section">
        <h2 class="section-title">Top Locations</h2>
        <div class="location-list">
          <div
            v-for="(loc, i) in admin.stats.topLocations"
            :key="loc.name"
            class="location-row"
          >
            <span class="loc-rank">{{ i + 1 }}</span>
            <span class="loc-name">{{ loc.name }}</span>
            <span class="loc-count"
              >{{ loc.count }} photo{{ loc.count !== 1 ? 's' : '' }}</span
            >
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const admin = useAdminStore()

onMounted(() => admin.fetchStats())
</script>

<style scoped>
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 28px;
}

.loading {
  color: var(--color-text-muted);
  padding: 40px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}

.section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px;
  box-shadow: var(--shadow-sm);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.location-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
}

.loc-rank {
  width: 24px;
  height: 24px;
  background: var(--color-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.loc-name {
  flex: 1;
}

.loc-count {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
</style>
