import { cognitoErrorMessage, useCognito } from '~/composables/useCognito';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const cognito = useCognito();

  const userCookie = useCookie<AuthUser | null>('ws_user', {
    maxAge: 60 * 60 * 24 * 30,
  });
  const accessCookie = useCookie<string | null>('ws_access', {
    maxAge: 60 * 60,
  });
  const refreshCookie = useCookie<string | null>('ws_refresh', {
    maxAge: 60 * 60 * 24 * 30,
  });

  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isLoggedIn = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  function init() {
    if (userCookie.value) {
      user.value = userCookie.value;
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const session = await cognito.signIn(email, password);
      const rawGroups = session.payload['cognito:groups'];
      const groups: string[] = Array.isArray(rawGroups)
        ? rawGroups.filter((g): g is string => typeof g === 'string')
        : [];

      const authUser: AuthUser = {
        id: String(session.payload['sub'] ?? ''),
        name: String(session.payload['name'] ?? email),
        email,
        isAdmin: groups.includes('admins'),
      };

      user.value = authUser;
      userCookie.value = authUser;
      accessCookie.value = session.accessToken;
      refreshCookie.value = session.refreshToken;
      return true;
    } catch (err) {
      error.value = cognitoErrorMessage(err);
      return false;
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

  async function forgotPassword(email: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await cognito.forgotPassword(email);
      return true;
    } catch (err) {
      error.value = cognitoErrorMessage(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function resetPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await cognito.resetPassword(email, code, newPassword);
      return true;
    } catch (err) {
      error.value = cognitoErrorMessage(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      if (accessCookie.value) {
        await cognito.globalSignOut(accessCookie.value);
      }
    } finally {
      user.value = null;
      userCookie.value = null;
      accessCookie.value = null;
      refreshCookie.value = null;
    }
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
    forgotPassword,
    resetPassword,
    logout,
  };
});
