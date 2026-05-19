<template>
  <div>
    <h1 class="page-title">Photos</h1>

    <div class="card">
      <AdminPhotoTable :photos="photos.photos" @delete="handleDelete" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const photos = usePhotosStore()

onMounted(() => {
  if (photos.photos.length === 0) photos.fetchPhotos()
})

async function handleDelete(id: string) {
  if (confirm('Delete this photo?')) {
    await photos.deletePhoto(id)
  }
}
</script>

<style scoped>
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 28px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px;
  box-shadow: var(--shadow-sm);
}
</style>
