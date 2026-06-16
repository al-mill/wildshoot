<template>
  <div class="layout">
    <AppHeader />
    <div class="body">
      <nav class="sidebar">
        <p class="sidebar-heading">Admin</p>
        <NuxtLink
          to="/admin"
          class="sidebar-link"
          :class="{ active: route.path === '/admin' }"
        >
          Dashboard
        </NuxtLink>
        <NuxtLink to="/admin/photos" class="sidebar-link" active-class="active"
          >Photos</NuxtLink
        >
        <NuxtLink to="/admin/users" class="sidebar-link" active-class="active"
          >Users</NuxtLink
        >
      </nav>
      <main class="main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.body {
  flex: 1;
  display: flex;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px;
}

.sidebar {
  width: 180px;
  flex-shrink: 0;
  padding: 28px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 1px solid var(--color-border);
  margin-right: 40px;
}

.sidebar-heading {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  font-weight: 600;
  padding: 0 12px;
  margin-bottom: 8px;
}

.sidebar-link {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 0.9rem;
  transition:
    background 0.15s,
    color 0.15s;
}

.sidebar-link:hover,
.sidebar-link.active {
  background: var(--color-bg);
  color: var(--color-text);
  text-decoration: none;
}

.main {
  flex: 1;
  padding: 28px 0;
  min-width: 0;
}
</style>
