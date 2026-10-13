import { cognitoErrorMessage, useCognito } from '~/composables/useCognito';
import { isExpiring, singleFlight } from '~/utils/session';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const cognito = useCognito();

  const sessionCookie = <T>(name: string, maxAge: number) =>
    useCookie<T | null>(name, {
      maxAge,
      path: '/',
      sameSite: 'strict',
      secure: !import.meta.dev,
    });

  const userCookie = sessionCookie<AuthUser>('ws_user', 60 * 60 * 24 * 30);
  const accessCookie = sessionCookie<string>('ws_access', 60 * 60);
  const refreshCookie = sessionCookie<string>('ws_refresh', 60 * 60 * 24 * 30);

  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isLoggedIn = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  function init() {
    if (userCookie.value && refreshCookie.value) {
      user.value = userCookie.value;
    } else if (userCookie.value) {
      clearSession();
    }
  }

  function clearSession() {
    user.value = null;
    userCookie.value = null;
    accessCookie.value = null;
    refreshCookie.value = null;
  }

  const refreshAccessToken = singleFlight(async () => {
    if (!refreshCookie.value) throw new Error('No refresh token');
    const { accessToken } = await cognito.refreshSession(refreshCookie.value);
    accessCookie.value = accessToken;
    return accessToken;
  });

  async function getAccessToken(forceRefresh = false): Promise<string | null> {
    const current = accessCookie.value;
    if (current && !forceRefresh && !isExpiring(current)) return current;
    try {
      return await refreshAccessToken();
    } catch {
      clearSession();
      return null;
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
      // Logout sits behind the authorizer; an expired token would be rejected and leave the refresh token unrevoked.
      const accessToken = await getAccessToken();
      if (accessToken) await cognito.signOut(accessToken);
    } finally {
      clearSession();
    }
  }

  return {
    user,
    isLoading,
    error,
    isLoggedIn,
    isAdmin,
    init,
    clearSession,
    getAccessToken,
    login,
    register,
    confirmSignUp,
    forgotPassword,
    resetPassword,
    logout,
  };
});
