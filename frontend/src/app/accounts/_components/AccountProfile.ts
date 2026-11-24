import type { AccountProfileFilter } from '@/lib/accounts';

// A API devolve o id da especialidade; as telas mostram o nome.
const SPECIALISM_LABELS: Record<string, string> = {
  doctor: 'Medicina',
  physiotherapist: 'Fisioterapia',
  psychologist: 'Psicologia',
};

// Texto do perfil como em `contas.html`: "Profissional: Psicologia".
export function profileLabel(
  profile: AccountProfileFilter,
  specialisms: string[],
) {
  switch (profile) {
    case 'none':
      return 'Sem perfil';
    case 'patient':
      return 'Paciente';
    case 'admin':
      return 'Administrador';
    case 'professional':
      return specialisms.length > 0
        ? `Profissional: ${specialisms.map((id) => SPECIALISM_LABELS[id] ?? id).join(', ')}`
        : 'Profissional';
  }
}

// "Tornar paciente" abre o "Adicionar paciente" de /patients com a conta
// escolhida.
export function makePatientHref(accountId: string) {
  return `/patients?account=${encodeURIComponent(accountId)}`;
}

// "Ver na lista": as listas filtram por nome, e-mail ou CPF; o e-mail é único.
export function listHref(profile: 'patient' | 'professional', email: string) {
  const base = profile === 'patient' ? '/patients' : '/professionals';

  return `${base}?q=${encodeURIComponent(email)}`;
}

export const MAKE_PROFESSIONAL_UNAVAILABLE =
  'Disponível com o cadastro de profissional, ainda não implementado.';
