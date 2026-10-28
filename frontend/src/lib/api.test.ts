import { ApiError, request } from './api';

function mockResponse({
  status = 200,
  ok = true,
  json,
}: {
  status?: number;
  ok?: boolean;
  json?: () => Promise<unknown>;
}) {
  return { status, ok, json } as unknown as Response;
}

describe('request', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('devolve o JSON da resposta com os cookies da sessão', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({ json: () => Promise.resolve({ id: 'uuid' }) }),
    );

    await expect(request<{ id: string }>('/me')).resolves.toEqual({
      id: 'uuid',
    });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/me', {
      credentials: 'include',
    });
  });

  it('lança ApiError com o status, o code e a message do corpo de erro', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        status: 409,
        ok: false,
        json: () =>
          Promise.resolve({
            status: 'PATIENT_PROFILE_ALREADY_EXISTS',
            message: 'A conta já possui perfil de paciente.',
          }),
      }),
    );

    const error = await request('/patients').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'PATIENT_PROFILE_ALREADY_EXISTS',
      apiMessage: 'A conta já possui perfil de paciente.',
      message: 'A conta já possui perfil de paciente.',
    });
  });

  it.each([
    ['sem corpo', undefined],
    ['com corpo que não é JSON', () => Promise.reject(new SyntaxError('x'))],
    ['com corpo sem status e message', () => Promise.resolve({ foo: 1 })],
  ])(
    'lança ApiError só com o status quando a resposta vem %s',
    async (_case, json) => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse({ status: 500, ok: false, json }),
      );

      const error = await request('/accounts').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 500,
        code: undefined,
        apiMessage: undefined,
        message: 'API request failed with status 500',
      });
    },
  );
});
