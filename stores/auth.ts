import { cognitoErrorMessage, useCognito } from '~/composables/useCognito';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const cognito = useCognito();

  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const userCookie = useCookie<AuthUser | null>('ws_user', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  const accessTokenCookie = useCookie<string | null>('ws_access', {
    default: () => null,
    maxAge: 60 * 60,
    sameSite: 'lax',
  });
  const refreshTokenCookie = useCookie<string | null>('ws_refresh', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });

  const isLoggedIn = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  function init() {
    if (userCookie.value) {
      user.value = userCookie.value;
    }
  }

  async function login(email: string, password: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const session = await cognito.signIn(email, password);
      const payload = session.getIdToken().payload;
      const groups: unknown = payload['cognito:groups'];

      user.value = {
        id: String(payload['sub'] ?? ''),
        name: String(payload['name'] ?? payload['email'] ?? ''),
        email: String(payload['email'] ?? ''),
        isAdmin: Array.isArray(groups) && groups.includes('admins'),
      };

      userCookie.value = user.value;
      accessTokenCookie.value = session.getAccessToken().getJwtToken();
      refreshTokenCookie.value = session.getRefreshToken().getToken();
    } catch (err) {
      error.value = cognitoErrorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function register(
    name: string,
    email: string,
    password: string
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await cognito.signUp(name, email, password);
      return true;
    } catch (err) {
      error.value = cognitoErrorMessage(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function confirmSignUp(email: string, code: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await cognito.confirmSignUp(email, code);
      return true;
    } catch (err) {
      error.value = cognitoErrorMessage(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    if (user.value) {
      try {
        await cognito.globalSignOut(user.value.email);
      } catch {
        // best-effort — clear local state regardless
      }
    }
    user.value = null;
    userCookie.value = null;
    accessTokenCookie.value = null;
    refreshTokenCookie.value = null;
  }

  function getAccessToken(): string | null {
    return accessTokenCookie.value;
  }

  return {
    user,
    isLoading,
    error,
    isLoggedIn,
    isAdmin,
    init,
    login,
    register,
    confirmSignUp,
    logout,
    getAccessToken,
  };
});
