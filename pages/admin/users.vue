<template>
  <div>
    <h1 class="page-title">Users</h1>

    <div v-if="admin.isLoading" class="loading">Loading…</div>

    <div v-else class="card">
      <AdminUserTable :users="admin.users" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const admin = useAdminStore()

onMounted(() => admin.fetchUsers())
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

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
</style>
