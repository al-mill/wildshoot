<template>
  <header class="header">
    <div class="inner">
      <NuxtLink to="/" class="brand">Wild Shoot</NuxtLink>

      <nav class="nav">
        <NuxtLink to="/" class="nav-link">Feed</NuxtLink>
        <NuxtLink v-if="auth.isLoggedIn" to="/upload" class="nav-link"
          >Upload</NuxtLink
        >
        <NuxtLink v-if="auth.isAdmin" to="/admin" class="nav-link"
          >Admin</NuxtLink
        >
      </nav>

      <div class="auth">
        <template v-if="auth.isLoggedIn">
          <span class="user-name">{{ auth.user?.name }}</span>
          <button class="btn-ghost" @click="auth.logout()">Log out</button>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="btn-ghost">Log in</NuxtLink>
          <NuxtLink to="/register" class="btn-primary">Sign up</NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const auth = useAuthStore()
</script>

<style scoped>
.header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.brand {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
  flex-shrink: 0;
}

.brand:hover {
  text-decoration: none;
}

.nav {
  display: flex;
  gap: 4px;
  flex: 1;
}

.nav-link {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 0.9rem;
  transition:
    color 0.15s,
    background 0.15s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--color-text);
  background: var(--color-bg);
  text-decoration: none;
}

.auth {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.user-name {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.btn-ghost {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: 0.875rem;
  transition: background 0.15s;
  text-decoration: none;
  display: inline-block;
}

.btn-ghost:hover {
  background: var(--color-bg);
  text-decoration: none;
}

.btn-primary {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: 0.875rem;
  display: inline-block;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  text-decoration: none;
}
</style>
