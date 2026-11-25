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
    ).toEqual(['Início', 'Profissionais', 'PTS', 'Pacientes']);
  });

  it('mantém os itens compartilhados no menu do admin', () => {
    expect(labels(account({ role: 'admin' }))).toEqual([
      'Início',
      'Contas',
      'Profissionais',
      'PTS',
      'Pacientes',
    ]);
  });

  it('mostra propostas de PTS com rótulo claro para o paciente', () => {
    expect(labels(account({ patientProfileId: 'patient' }))).toContain(
      'Propostas de PTS',
    );
    expect(labels(account({ patientProfileId: 'patient' }))).not.toContain(
      'PTS',
    );
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toContain('PTS');
    expect(labels(account({ role: 'admin' }))).toContain('PTS');
    expect(labels(account({}))).not.toContain('PTS');
  });

  it('usa ícones diferentes para medicações e propostas de PTS', () => {
    const navigation = getNavigation(
      account({ patientProfileId: 'patient' }),
      '/pts',
    );

    expect(navigation.find((item) => item.href === '/medications')?.icon).toBe(
      'pill',
    );
    expect(
      navigation.find((item) => item.href === '/pts/proposals')?.icon,
    ).toBe('clipboard');
  });

  it('mostra o link para propostas nos outros perfis, mas não para conta sem perfil', () => {
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toContain('PTS');
    expect(labels(account({ role: 'admin' }))).toContain('PTS');
    expect(labels(account({}))).not.toContain('PTS');
  });

  it('mostra "Meu PTS" só para o paciente (RFPTS004)', () => {
    expect(
      getNavigation(account({ patientProfileId: 'patient' }), '/pts'),
    ).toContainEqual({
      href: '/pts',
      icon: 'check',
      label: 'Meu PTS',
      current: true,
    });

    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).not.toContain('Meu PTS');

    expect(labels(account({ role: 'admin' }))).not.toContain('Meu PTS');
  });

  it('mantém o menu alinhado aos acessos de cada perfil', () => {
    expect(labels(account({ role: 'admin' }))).toEqual([
      'Início',
      'Contas',
      'Profissionais',
      'PTS',
      'Pacientes',
    ]);

    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toEqual(['Início', 'Profissionais', 'PTS', 'Pacientes']);

    expect(labels(account({ patientProfileId: 'patient' }))).toEqual([
      'Início',
      'Meu PTS',
      'Medicações',
      'Propostas de PTS',
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
