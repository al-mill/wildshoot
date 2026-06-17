import { cognitoErrorMessage, useCognito } from '~/composables/useCognito';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isLoggedIn = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  async function login(email: string, _password: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await wait(600); // TODO: POST /api/auth/login
      user.value = {
        id: '1',
        name: 'Alex Miller',
        email,
        isAdmin: email.startsWith('admin'),
      };
    } catch {
      error.value = 'Login failed — please try again';
    } finally {
      isLoading.value = false;
    }
  }

  async function register(name: string, email: string, _password: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await wait(600); // TODO: POST /api/auth/register
      user.value = { id: String(Date.now()), name, email, isAdmin: false };
    } catch {
      error.value = 'Registration failed — please try again';
    } finally {
      isLoading.value = false;
    }
  }

  function logout() {
    user.value = null;
  }

  return {
    user,
    isLoading,
    error,
    isLoggedIn,
    isAdmin,
    login,
    register,
    logout,
  };
});
