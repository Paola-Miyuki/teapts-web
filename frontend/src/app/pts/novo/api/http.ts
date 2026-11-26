import { API_URL, ApiError } from '@/lib/api';

// O erro é o mesmo de `lib/api` (status 0 = falha de rede).
export { ApiError };

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    // O SuperTokens (initSuperTokens) já intercepta fetch e envia/renova a sessão via cookies.
    res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.status, body?.message);
  return body as T;
}
