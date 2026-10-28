// Cliente HTTP único da API: URL base, cookies de sessão e erro com status.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// Resposta da API fora da faixa 2xx; quem chama decide a reação pelo status.
// `code` e `apiMessage` vêm do corpo de erro { status, message }, quando há.
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly apiMessage?: string;

  constructor(status: number, code?: string, apiMessage?: string) {
    super(apiMessage ?? `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

// Lê o corpo de erro { status, message }; corpo vazio ou inválido vira {}.
async function readErrorBody(response: Response) {
  try {
    const body: unknown = await response.json();

    if (!body || typeof body !== 'object') {
      return {};
    }

    const { status, message } = body as Record<string, unknown>;

    return {
      code: typeof status === 'string' ? status : undefined,
      message: typeof message === 'string' ? message : undefined,
    };
  } catch {
    return {};
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
    const { code, message } = await readErrorBody(response);

    throw new ApiError(response.status, code, message);
  }

  return (await response.json()) as T;
}
