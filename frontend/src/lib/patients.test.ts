import {
  getAccountsWithoutProfile,
  getPatient,
  getPatients,
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

describe('getPatients e getPatient', () => {
  const API = 'http://localhost:3000';

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    });
  });

  it('não envia filtros vazios nem a busca só com espaços', async () => {
    await getPatients({ page: 1, limit: 10, q: '   ', status: [] });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/authorized?page=1&limit=10`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('envia q, status, responsável, datas e ordenação', async () => {
    await getPatients({
      page: 2,
      limit: 25,
      q: ' mari ',
      status: ['concluded', 'none'],
      responsibleProfessionalId: 'prof-1',
      registeredFrom: '2026-01-01',
      registeredTo: '2026-02-01',
      sort: 'registeredAt',
      order: 'desc',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/authorized?q=mari&status=concluded%2Cnone&responsibleProfessionalId=prof-1&registeredFrom=2026-01-01&registeredTo=2026-02-01&sort=registeredAt&order=desc&page=2&limit=25`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('busca o detalhe pelo id', async () => {
    await getPatient('patient-1');

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
