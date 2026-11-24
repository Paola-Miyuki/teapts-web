// Registro no conselho regional do perfil profissional, como as respostas o
// mostram: o conselho vem da especialidade (tabela de profissões do
// Dicionário de dados do front).

import { Specialism } from './enums/specialism.enum';
import type { Uf } from './enums/uf.enum';

export const SPECIALISM_COUNCILS = {
  [Specialism.Psychologist]: 'CRP',
  [Specialism.Doctor]: 'CRM',
  [Specialism.Physiotherapist]: 'Crefito',
} as const satisfies Record<Specialism, string>;

/** Conselhos regionais da lista fixa de especialidades. */
export const COUNCILS = ['CRP', 'CRM', 'Crefito'] as const;
export type Council = (typeof COUNCILS)[number];

/** Especialidades cujo conselho regional está em `councils`. */
export function specialismsOfCouncils(councils: Council[]): Specialism[] {
  return (Object.keys(SPECIALISM_COUNCILS) as Specialism[]).filter(
    (specialism) => councils.includes(SPECIALISM_COUNCILS[specialism]),
  );
}

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
