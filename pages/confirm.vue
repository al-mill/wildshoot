<template>
  <div class="page">
    <div class="card">
      <h1 class="title">Check your email</h1>
      <p class="sub">
        We sent a confirmation code to
        <strong>{{ email }}</strong>
      </p>

      <form @submit.prevent="handleSubmit">
        <label class="field">
          Confirmation code
          <input
            v-model="code"
            type="text"
            class="input"
            placeholder="123456"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
          />
        </label>

        <p v-if="auth.error" class="error">{{ auth.error }}</p>

        <button type="submit" class="btn-submit" :disabled="auth.isLoading">
          {{ auth.isLoading ? 'Confirming…' : 'Confirm account' }}
        </button>
      </form>

      <p class="footer-link">
        Already confirmed? <NuxtLink to="/login">Log in</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = computed(() => String(route.query.email ?? ''))
const code = ref('')

async function handleSubmit() {
  const ok = await auth.confirmSignUp(email.value, code.value)
  if (ok) router.push('/login')
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
