import { getNavigation } from './account';

function labels(kind: Parameters<typeof getNavigation>[0]) {
  return getNavigation(kind, '/home').map((item) => item.label);
}

describe('getNavigation', () => {
  it('mostra o item "Criar perfil de paciente" só para o admin', () => {
    expect(getNavigation('admin', '/patients/new')).toContainEqual({
      href: '/patients/new',
      icon: 'plus',
      label: 'Criar perfil de paciente',
      current: true,
    });
  });

  it('mantém o menu do profissional sem o item de admin', () => {
    expect(labels('professional')).toEqual(['Início', 'Profissionais', 'PTS']);
  });

  it('mantém os itens compartilhados no menu do admin', () => {
    expect(labels('admin')).toEqual([
      'Início',
      'Profissionais',
      'PTS',
      'Criar perfil de paciente',
    ]);
  });
});
