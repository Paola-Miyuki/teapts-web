import { deleteMe, getNavigation, type Account } from './account';
import { personalData } from '@/test-utils/account';

function account(overrides: Partial<Account> = {}): Account {
  return {
    accountId: 'account',
    name: 'Pessoa',
    email: 'pessoa@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [],
    ...overrides,
  };
}

function labels(current: Account) {
  return getNavigation(current, '/home').map((item) => item.label);
}

describe('getNavigation', () => {
  it('mostra o item "Pacientes" para o admin e o profissional', () => {
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toContain('Pacientes');
    expect(labels(account({ patientProfileId: 'patient' }))).not.toContain(
      'Pacientes',
    );
    expect(labels(account())).not.toContain('Pacientes');

    expect(
      getNavigation(account({ role: 'admin' }), '/patients'),
    ).toContainEqual({
      href: '/patients',
      icon: 'patient',
      label: 'Pacientes',
      current: true,
    });
  });

  it('mostra profissionais e PTS no menu do profissional', () => {
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toEqual(['Início', 'Profissionais', 'PTS', 'Pacientes', 'Atendimentos']);
  });

  it('mantém os itens compartilhados no menu do admin', () => {
    expect(labels(account({ role: 'admin' }))).toEqual([
      'Início',
      'Contas',
      'Profissionais',
      'PTS',
      'Pacientes',
      'Atendimentos',
    ]);
  });

  it('mostra um só item "PTS" para o paciente, com o ícone do profissional', () => {
    const patient = account({ patientProfileId: 'patient' });
    const professional = getNavigation(
      account({ professionalProfileIds: ['professional'] }),
      '/pts',
    ).find((item) => item.label === 'PTS');

    expect(labels(patient).filter((label) => label === 'PTS')).toHaveLength(1);
    expect(labels(patient)).not.toContain('Propostas de PTS');
    expect(getNavigation(patient, '/pts')).toContainEqual({
      href: '/pts',
      icon: 'clipboard',
      label: 'PTS',
      current: true,
    });
    expect(professional?.icon).toBe('clipboard');
  });

  it('usa ícones diferentes para medicações e PTS', () => {
    const navigation = getNavigation(
      account({ patientProfileId: 'patient' }),
      '/pts',
    );

    expect(navigation.find((item) => item.href === '/medications')?.icon).toBe(
      'pill',
    );
    expect(navigation.find((item) => item.href === '/pts')?.icon).toBe(
      'clipboard',
    );
  });

  it('mostra o item PTS ao admin e ao profissional, mas não à conta sem perfil', () => {
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toContain('PTS');
    expect(labels(account({ role: 'admin' }))).toContain('PTS');
    expect(labels(account({}))).not.toContain('PTS');
  });

  it('leva o paciente ao PTS em /pts e o admin e o profissional à lista de PTS, também em /pts (RFPTS004)', () => {
    expect(
      getNavigation(account({ patientProfileId: 'patient' }), '/pts').map(
        (item) => item.href,
      ),
    ).not.toContain('/pts/proposals');

    for (const other of [
      account({ professionalProfileIds: ['professional'] }),
      account({ role: 'admin' }),
    ]) {
      const hrefs = getNavigation(other, '/pts').map((item) => item.href);

      expect(hrefs).toContain('/pts');
      expect(hrefs).not.toContain('/pts/proposals');
    }
  });

  it('mantém o menu alinhado aos acessos de cada perfil', () => {
    expect(labels(account({ role: 'admin' }))).toEqual([
      'Início',
      'Contas',
      'Profissionais',
      'PTS',
      'Pacientes',
      'Atendimentos',
    ]);

    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toEqual(['Início', 'Profissionais', 'PTS', 'Pacientes', 'Atendimentos']);

    expect(labels(account({ patientProfileId: 'patient' }))).toEqual([
      'Início',
      'PTS',
      'Atendimentos',
      'Medicações',
      'Documentos',
    ]);

    expect(labels(account())).toEqual(['Início']);
  });
});

describe('deleteMe', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('chama DELETE /me com cookies e devolve a conta desativada', async () => {
    const body = {
      id: 'account',
      status: 'inactive',
      deactivatedAt: '2026-11-10T15:00:00.000Z',
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });

    await expect(deleteMe()).resolves.toEqual(body);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/me',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });
});
