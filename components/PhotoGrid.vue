<template>
  <div v-if="isLoading" class="state">
    <div class="spinner" />
  </div>
  <p v-else-if="photos.length === 0" class="state empty">No photos yet.</p>
  <div v-else class="grid">
    <PhotoCard v-for="photo in photos" :key="photo.id" :photo="photo" />
  </div>
</template>

<script setup lang="ts">
import type { Photo } from '~/types'
defineProps<{ photos: Photo[]; isLoading: boolean }>()
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.state {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

.empty {
  color: var(--color-text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
