<template>
  <div>
    <h1 class="page-title">Upload a Photo</h1>
    <UploadForm @uploaded="onUploaded" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const router = useRouter();

function onUploaded() {
  setTimeout(() => router.push('/'), 1200);
}
</script>

<style scoped>
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 28px;
}
</style>
