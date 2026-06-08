const BASE = (import.meta as any).env?.VITE_API_URL ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function crud<T>(base: string) {
  return {
    list:   ()                      => request<T[]>(base),
    create: (body: Omit<T, 'id'>)  => request<T>(base, { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: T)  => request<T>(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string)           => request<{ ok: boolean }>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  pipeline: crud<import('./types').Property>('/pipeline'),
  config: {
    get: (key: string) =>
      request<{ value: string | null }>(`/config/${key}`),
    set: (key: string, value: unknown) =>
      request<{ ok: boolean }>(`/config/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
  },
};
