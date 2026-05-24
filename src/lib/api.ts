const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })
  const data = await res.json()

  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Błąd serwera')
  return data as T
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_color: string
    status: string
  }
}

export const api = {
  auth: {
    register: (body: { username: string; displayName: string; email: string; password: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    me: (token: string) =>
      request<{ user: AuthResponse['user'] }>('/api/auth/me', {}, token),

    logout: (token: string) =>
      request('/api/auth/logout', { method: 'POST' }, token),
  },
}

export const tokenStore = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('pz_token')
  },
  set: (token: string) => {
    sessionStorage.setItem('pz_token', token)
  },
  clear: () => {
    sessionStorage.removeItem('pz_token')
    document.cookie = 'pz_token=; path=/; max-age=0'
  },
}
