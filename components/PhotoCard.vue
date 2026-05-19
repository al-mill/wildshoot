<template>
  <article class="card">
    <img :src="photo.thumbnailUrl" :alt="photo.title" class="image" loading="lazy" />
    <div class="body">
      <h3 class="title">{{ photo.title }}</h3>
      <p v-if="photo.description" class="desc">{{ photo.description }}</p>
      <div class="meta">
        <span class="location">📍 {{ photo.location }}</span>
        <span class="author">{{ photo.userName }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Photo } from '~/types'
defineProps<{ photo: Photo }>()
</script>

<style scoped>
.card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s, transform 0.2s;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.image {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
}

.body {
  padding: 14px 16px;
}

.title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.desc {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 10px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 65%;
}
</style>
