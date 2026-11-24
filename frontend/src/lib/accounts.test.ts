import { deactivateAccount, getAccount, getAccounts } from './accounts';

const API = 'http://localhost:3000';

function mockFetch() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
  });
}

describe('accounts', () => {
  beforeEach(mockFetch);

  it('monta a query só com os filtros preenchidos', async () => {
    await getAccounts({ page: 1, limit: 10, q: '  ', profile: [], status: '' });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      `${API}/accounts?page=1&limit=10`,
    );

    await getAccounts({
      page: 2,
      limit: 25,
      q: ' ana ',
      profile: ['none', 'admin'],
      status: 'active',
      createdFrom: '2026-01-01',
      createdTo: '2026-02-01',
      sort: 'createdAt',
      order: 'desc',
    });
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
      `${API}/accounts?q=ana&profile=none%2Cadmin&status=active&createdFrom=2026-01-01&createdTo=2026-02-01&sort=createdAt&order=desc&page=2&limit=25`,
    );
  });

  it('consulta e desativa a conta pelo id', async () => {
    await getAccount('a/b');
    await deactivateAccount('abc');

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe(`${API}/accounts/a%2Fb`);
    expect(calls[1][0]).toBe(`${API}/accounts/abc`);
    expect(calls[1][1]).toMatchObject({ method: 'DELETE' });
  });
});
