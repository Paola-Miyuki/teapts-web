import { getNavigation, type Account } from './account';
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
      'Profissionais',
      'PTS',
      'Pacientes',
    ]);
  });

  it('mostra PTS para paciente, profissional e admin, mas não para conta sem perfil', () => {
    expect(labels(account({ patientProfileId: 'patient' }))).toContain('PTS');
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
      'PTS',
    ]);

    expect(labels(account())).toEqual(['Início']);
  });
});
