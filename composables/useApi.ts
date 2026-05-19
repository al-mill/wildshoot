// Thin fetch wrapper — swap mock store actions for real calls once backend is deployed
export const useApi = () => {
  const config = useRuntimeConfig()
  const base = config.public.apiUrl as string

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return res.json() as Promise<T>
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return res.json() as Promise<T>
  }

  async function postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${base}${path}`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return res.json() as Promise<T>
  }

  async function del(path: string): Promise<void> {
    const res = await fetch(`${base}${path}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`${res.status} ${path}`)
  }

  return { get, post, postForm, del }
}
