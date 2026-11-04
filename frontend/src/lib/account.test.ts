import { getNavigation, type Account } from './account';

function account(overrides: Partial<Account> = {}): Account {
  return {
    accountId: 'account',
    name: 'Pessoa',
    email: 'pessoa@example.com',
    role: 'user',
    patientProfileId: null,
    professionalProfileIds: [],
    ...overrides,
  };
}

function labels(current: Account) {
  return getNavigation(current, '/home').map((item) => item.label);
}

describe('getNavigation', () => {
  it('mostra o item "Pacientes" só para o admin', () => {
    expect(
      getNavigation(account({ role: 'admin' }), '/patients'),
    ).toContainEqual({
      href: '/patients',
      icon: 'patient',
      label: 'Pacientes',
      action: 'viewPatientRegistry',
      current: true,
    });
  });

  it('mostra profissionais e PTS no menu do profissional', () => {
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toEqual(['Início', 'Profissionais', 'PTS']);
  });

  it('mantém os itens compartilhados no menu do admin', () => {
    expect(labels(account({ role: 'admin' }))).toEqual([
      'Início',
      'Profissionais',
      'Pacientes',
    ]);
  });

  it('mostra PTS para paciente e profissional, mas não para admin', () => {
    expect(labels(account({ patientProfileId: 'patient' }))).toContain('PTS');
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toContain('PTS');
    expect(labels(account({ role: 'admin' }))).not.toContain('PTS');
  });

  it('mantém o menu alinhado aos acessos de cada perfil', () => {
    expect(labels(account({ role: 'admin' }))).toEqual([
      'Início',
      'Profissionais',
      'Pacientes',
    ]);
    expect(
      labels(account({ professionalProfileIds: ['professional'] })),
    ).toEqual(['Início', 'Profissionais', 'PTS']);
    expect(labels(account({ patientProfileId: 'patient' }))).toEqual([
      'Meu cuidado',
      'Profissionais',
      'PTS',
    ]);
    expect(labels(account())).toEqual(['Início', 'Profissionais']);
  });
});
