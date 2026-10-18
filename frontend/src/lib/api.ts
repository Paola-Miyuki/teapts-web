// Cliente HTTP único da API: URL base, cookies de sessão e erro com status.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// Resposta da API fora da faixa 2xx; quem chama decide a reação pelo status.
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Chama a API com a URL base e os cookies da sessão (SuperTokens).
export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, { ...init, credentials: 'include' });
}

// Chama a API e devolve o JSON tipado; lança ApiError quando !response.ok.
export async function request<T>(path: string, init?: RequestInit) {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return (await response.json()) as T;
}
