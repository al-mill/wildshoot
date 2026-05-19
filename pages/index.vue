<template>
  <div>
    <div v-if="!auth.isLoggedIn" class="hero">
      <h1 class="hero-title">Share your world,<br />one shot at a time.</h1>
      <p class="hero-sub">
        Upload photos with location data and explore shots from around the globe.
      </p>
      <div class="hero-actions">
        <NuxtLink to="/register" class="btn-primary">Get started</NuxtLink>
        <NuxtLink to="/login" class="btn-ghost">Log in</NuxtLink>
      </div>
    </div>

    <div v-if="auth.isLoggedIn" class="feed-header">
      <h2 class="feed-title">Recent Photos</h2>
      <NuxtLink to="/upload" class="btn-primary-sm">+ Upload</NuxtLink>
    </div>

    <PhotoGrid :photos="photos.photos" :is-loading="photos.isLoading" />
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const photos = usePhotosStore()

onMounted(() => photos.fetchPhotos())
</script>

<style scoped>
.hero {
  text-align: center;
  padding: 80px 0 56px;
}

.hero-title {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 16px;
}

.hero-sub {
  font-size: 1.125rem;
  color: var(--color-text-muted);
  max-width: 480px;
  margin: 0 auto 32px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.feed-title {
  font-size: 1.5rem;
  font-weight: 700;
}

.btn-primary {
  display: inline-block;
  padding: 10px 24px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-sm);
  font-weight: 500;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  text-decoration: none;
}

.btn-ghost {
  display: inline-block;
  padding: 10px 24px;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  font-weight: 500;
  transition: background 0.15s;
}

.btn-ghost:hover {
  background: var(--color-bg);
  text-decoration: none;
}

.btn-primary-sm {
  display: inline-block;
  padding: 6px 16px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-primary-sm:hover {
  background: var(--color-primary-hover);
  text-decoration: none;
}
</style>
