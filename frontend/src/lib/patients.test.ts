import {
  getAccountsWithoutProfile,
  getPatientAccounts,
  isValidPhone,
} from './patients';

describe('isValidPhone', () => {
  it.each([
    '(11) 98765-4321',
    '(11) 3456-7890',
    '11987654321',
    '+55 11 98765-4321',
    '5511987654321',
  ])('aceita %s', (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  it.each([
    '98765',
    '987654321',
    '(11) 98765-43210',
    '11 9876a-4321',
    '+1 (11) 98765-4321',
  ])('recusa %s', (phone) => {
    expect(isValidPhone(phone)).toBe(false);
  });
});

describe('consultas de contas', () => {
  const API = 'http://localhost:3000';
  const response = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(response),
    });
  });

  it('lista os pacientes sem o q quando não há busca', async () => {
    await getPatientAccounts(1, 10);

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/accounts?isPatient=true&page=1&limit=10`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('manda o q codificado e o signal na lista de pacientes', async () => {
    const { signal } = new AbortController();

    await getPatientAccounts(2, 10, { q: 'maria silva', signal });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/accounts?isPatient=true&q=maria+silva&page=2&limit=10`,
      expect.objectContaining({ credentials: 'include', signal }),
    );
  });

  it('não manda o q vazio', async () => {
    await getPatientAccounts(1, 10, { q: '   ' });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/accounts?isPatient=true&page=1&limit=10`,
      expect.anything(),
    );
  });

  it('lista só contas sem perfil de paciente nem profissional', async () => {
    await getAccountsWithoutProfile();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/accounts?isPatient=false&isProfessional=false&page=1&limit=20`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('busca contas livres com o q e o signal', async () => {
    const { signal } = new AbortController();

    await getAccountsWithoutProfile({ q: 'mari', signal });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/accounts?isPatient=false&isProfessional=false&q=mari&page=1&limit=20`,
      expect.objectContaining({ signal }),
    );
  });
});
