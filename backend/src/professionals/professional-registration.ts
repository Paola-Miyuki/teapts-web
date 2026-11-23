// Registro no conselho regional do perfil profissional, como as respostas o
// mostram: o conselho vem da especialidade (tabela de profissões do
// Dicionário de dados do front).

import { Specialism } from './enums/specialism.enum';
import type { Uf } from './enums/uf.enum';

const SPECIALISM_COUNCILS: Record<Specialism, string> = {
  [Specialism.Psychologist]: 'CRP',
  [Specialism.Doctor]: 'CRM',
  [Specialism.Physiotherapist]: 'Crefito',
};

export type ProfessionalRegistration = {
  council: string;
  number: string;
  state: Uf;
};

/** `null` quando o perfil ainda não tem número e UF do registro. */
export function toProfessionalRegistration(
  specialism: Specialism,
  number: string | null | undefined,
  state: Uf | null | undefined,
): ProfessionalRegistration | null {
  return number && state
    ? { council: SPECIALISM_COUNCILS[specialism], number, state }
    : null;
}
