import {
  createSupportContact,
  deleteSupportContact,
  getAccountsWithoutProfile,
  getPatient,
  getPatients,
  getSupportContacts,
  isValidPhone,
  updateSupportContact,
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

describe('contatos de suporte', () => {
  const API = 'http://localhost:3000';
  const URL = `${API}/patients/patient-1/support-contacts`;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: [] }),
    });
  });

  it('lista os contatos do paciente', async () => {
    await getSupportContacts('patient-1');

    expect(global.fetch).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('cria com POST e o corpo em JSON', async () => {
    await createSupportContact('patient-1', {
      name: 'Joana',
      phone: '(11) 98765-4321',
      isEmergency: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Joana',
          phone: '(11) 98765-4321',
          isEmergency: true,
        }),
      }),
    );
  });

  it('atualiza com PATCH, mandando null para limpar o campo', async () => {
    await updateSupportContact('patient-1', 'contact/1', { email: null });

    expect(global.fetch).toHaveBeenCalledWith(
      `${URL}/contact%2F1`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ email: null }),
      }),
    );
  });

  it('remove com DELETE e aceita a resposta 204 sem corpo', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
      json: jest.fn().mockRejectedValue(new Error('sem corpo')),
    });

    await expect(
      deleteSupportContact('patient-1', 'contact-1'),
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      `${URL}/contact-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
