// Registro no conselho regional do perfil profissional, como as respostas o
// mostram: o conselho e o nome exibido vêm da especialidade (tabela de
// profissões do propriedades-front.md).

import { Specialism } from './enums/specialism.enum';
import type { Uf } from './enums/uf.enum';

export const SPECIALISM_NAMES = {
  [Specialism.Doctor]: 'Médico',
  [Specialism.FamilyDoctor]: 'Médico de família e comunidade',
  [Specialism.Pediatrician]: 'Pediatra',
  [Specialism.Neuropediatrician]: 'Neuropediatra',
  [Specialism.Neurologist]: 'Neurologista',
  [Specialism.ChildPsychiatrist]: 'Psiquiatra da infância e adolescência',
  [Specialism.Geneticist]: 'Geneticista',
  [Specialism.Nurse]: 'Enfermeiro',
  [Specialism.NursingTechnician]: 'Técnico de enfermagem',
  [Specialism.Psychologist]: 'Psicólogo',
  [Specialism.Neuropsychologist]: 'Neuropsicólogo',
  [Specialism.SocialWorker]: 'Assistente social',
  [Specialism.Nutritionist]: 'Nutricionista',
  [Specialism.Physiotherapist]: 'Fisioterapeuta',
  [Specialism.OccupationalTherapist]: 'Terapeuta ocupacional',
  [Specialism.Pharmacist]: 'Farmacêutico',
  [Specialism.SpeechTherapist]: 'Fonoaudiólogo',
  [Specialism.Dentist]: 'Cirurgião-dentista',
  [Specialism.PediatricDentist]: 'Odontopediatra',
  [Specialism.PhysicalEducationProfessional]: 'Profissional de educação física',
} as const satisfies Record<Specialism, string>;

export const SPECIALISM_COUNCILS = {
  [Specialism.Doctor]: 'CRM',
  [Specialism.FamilyDoctor]: 'CRM',
  [Specialism.Pediatrician]: 'CRM',
  [Specialism.Neuropediatrician]: 'CRM',
  [Specialism.Neurologist]: 'CRM',
  [Specialism.ChildPsychiatrist]: 'CRM',
  [Specialism.Geneticist]: 'CRM',
  [Specialism.Nurse]: 'Coren',
  [Specialism.NursingTechnician]: 'Coren',
  [Specialism.Psychologist]: 'CRP',
  [Specialism.Neuropsychologist]: 'CRP',
  [Specialism.SocialWorker]: 'CRESS',
  [Specialism.Nutritionist]: 'CRN',
  [Specialism.Physiotherapist]: 'Crefito',
  [Specialism.OccupationalTherapist]: 'Crefito',
  [Specialism.Pharmacist]: 'CRF',
  [Specialism.SpeechTherapist]: 'CRFa',
  [Specialism.Dentist]: 'CRO',
  [Specialism.PediatricDentist]: 'CRO',
  [Specialism.PhysicalEducationProfessional]: 'CREF',
} as const satisfies Record<Specialism, string>;

/** Conselhos regionais da lista fixa de especialidades. */
export const COUNCILS = [
  'CRM',
  'Coren',
  'CRP',
  'CRESS',
  'CRN',
  'Crefito',
  'CRF',
  'CRFa',
  'CRO',
  'CREF',
] as const;
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
