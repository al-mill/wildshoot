<template>
  <div>
    <div class="toolbar">
      <input
        v-model="locationFilter"
        type="text"
        class="filter"
        placeholder="Filter by location…"
      />
    </div>

    <div class="wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Photo</th>
            <th>Title</th>
            <th>Location</th>
            <th>User</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="photo in paginated" :key="photo.id">
            <td><img :src="photo.thumbnailUrl" :alt="photo.title" class="thumb" /></td>
            <td>{{ photo.title }}</td>
            <td class="muted">{{ photo.location }}</td>
            <td class="muted">{{ photo.userName }}</td>
            <td class="muted">{{ fmt(photo.uploadedAt) }}</td>
            <td>
              <button class="btn-delete" @click="emit('delete', photo.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="paginated.length === 0" class="empty">No photos match the filter.</p>
    </div>

    <div v-if="totalPages > 1" class="pager">
      <button :disabled="page === 1" @click="page--">‹ Prev</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page === totalPages" @click="page++">Next ›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Photo } from '~/types'

const props = defineProps<{ photos: Photo[] }>()
const emit = defineEmits<{ delete: [id: string] }>()

const PAGE_SIZE = 10
const locationFilter = ref('')
const page = ref(1)

const filtered = computed(() => {
  const q = locationFilter.value.toLowerCase()
  return q ? props.photos.filter(p => p.location.toLowerCase().includes(q)) : props.photos
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const paginated = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

watch(locationFilter, () => {
  page.value = 1
})

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}

.filter {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 0.875rem;
  width: 280px;
  color: var(--color-text);
}

.filter:focus {
  outline: none;
  border-color: var(--color-primary);
}

.wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table th {
  text-align: left;
  padding: 10px 16px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 2px solid var(--color-border);
  font-weight: 600;
}

.table td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.table tr:last-child td {
  border-bottom: none;
}

.thumb {
  width: 56px;
  height: 42px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}

.muted {
  color: var(--color-text-muted);
}

.btn-delete {
  padding: 4px 12px;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--color-danger);
  font-size: 0.8rem;
  transition: background 0.15s;
}

.btn-delete:hover {
  background: #fef2f2;
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.pager button {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.875rem;
}

.pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
