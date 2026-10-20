const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Erro padronizado para respostas não-2xx (httpStatus 0 = falha de rede). */
export class ApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code?: string,
    message?: string,
  ) {
    super(message ?? 'Erro inesperado');
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // O SuperTokens (initSuperTokens) já intercepta fetch e envia/renova a sessão via cookies.
    res = await fetch(`${BASE_URL}${path}`, {
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
