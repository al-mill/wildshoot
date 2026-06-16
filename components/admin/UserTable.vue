<template>
  <div class="wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Photos</th>
          <th>Role</th>
          <th>Joined</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.name }}</td>
          <td class="muted">{{ user.email }}</td>
          <td>{{ user.photoCount }}</td>
          <td>
            <span :class="['badge', user.isAdmin ? 'admin' : 'user']">
              {{ user.isAdmin ? 'Admin' : 'User' }}
            </span>
          </td>
          <td class="muted">{{ fmt(user.joinedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="users.length === 0" class="empty">No users found.</p>
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types'

defineProps<{ users: User[] }>()

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<style scoped>
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
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.table tr:last-child td {
  border-bottom: none;
}

.muted {
  color: var(--color-text-muted);
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge.admin {
  background: #eff6ff;
  color: var(--color-primary);
}

.badge.user {
  background: #f1f5f9;
  color: var(--color-text-muted);
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
}
</style>
