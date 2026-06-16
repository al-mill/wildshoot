<template>
  <div class="page">
    <div class="card">
      <h1 class="title">Welcome back</h1>
      <p class="sub">Log in to your Wild Shoot account</p>

      <form @submit.prevent="handleSubmit">
        <label class="field">
          Email
          <input
            v-model="email"
            type="email"
            class="input"
            placeholder="you@example.com"
            required
          />
        </label>
        <label class="field">
          Password
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="••••••••"
            required
          />
        </label>

        <p v-if="auth.error" class="error">{{ auth.error }}</p>

        <button type="submit" class="btn-submit" :disabled="auth.isLoading">
          {{ auth.isLoading ? 'Logging in…' : 'Log in' }}
        </button>
      </form>

      <p class="footer-link">
        Don't have an account? <NuxtLink to="/register">Sign up</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')

async function handleSubmit() {
  await auth.login(email.value, password.value)
  if (!auth.error) router.push('/')
}
</script>

<style scoped>
.page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: var(--shadow-md);
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 6px;
}

.sub {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin-bottom: 28px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.input {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: 0.9rem;
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color 0.15s;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.error {
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: 0.875rem;
}

.btn-submit {
  padding: 10px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.footer-link {
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
</style>
