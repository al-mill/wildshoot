// Fetch wrapper for the API Gateway backend: sends the Cognito access token and,
// on a 401, refreshes it once and retries before sending the user to /login.
export const useApi = () => {
  const config = useRuntimeConfig();
  const base = String(config.public.apiUrl ?? '').replace(/\/$/, '');
  const auth = useAuthStore();

  async function send(path: string, init: RequestInit = {}) {
    const attempt = async (forceRefresh: boolean) => {
      const headers = new Headers(init.headers);
      const token = await auth.getAccessToken(forceRefresh);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(`${base}${path}`, { ...init, headers });
    };

    let res = await attempt(false);
    if (res.status === 401) res = await attempt(true);
    if (res.status === 401) {
      auth.clearSession();
      await navigateTo('/login');
    }
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res;
  }

  async function get<T>(path: string): Promise<T> {
    const res = await send(path);
    return res.json();
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await send(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await send(path, { method: 'POST', body: form });
    return res.json();
  }

  async function del(path: string): Promise<void> {
    await send(path, { method: 'DELETE' });
  }

  return { get, post, postForm, del };
};
