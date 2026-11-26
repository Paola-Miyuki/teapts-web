import type { PatientDetail } from '@/lib/patients';

// Dados do cadastro e diagnóstico do `GET /patients/:id` de Ana Clara Ribeiro
// (`paciente.html`), para os testes que só precisam do detalhe completo.
export const patientProfileExtras: Pick<
  PatientDetail,
  | 'birthDate'
  | 'sex'
  | 'gender'
  | 'filiation1'
  | 'filiation2'
  | 'address'
  | 'guardianPhone'
  | 'educationLevel'
  | 'schoolName'
  | 'referenceUnit'
  | 'clinicalHistory'
  | 'surgicalHistory'
  | 'familyHistory'
  | 'habits'
  | 'developmentalMilestones'
  | 'allergies'
  | 'noKnownAllergies'
  | 'diagnosis'
  | 'reassessment'
  | 'hasTcle'
> = {
  birthDate: '2019-04-18',
  sex: 'female',
  gender: 'cis_woman',
  filiation1: 'Juliana Ribeiro',
  filiation2: 'Não declarado',
  address: {
    zipCode: '80045140',
    street: 'Rua Itupava',
    number: '1240',
    complement: 'ap. 32',
    district: 'Alto da XV',
    city: 'Curitiba',
    state: 'pr',
  },
  guardianPhone: '41997015522',
  educationLevel: 'elementary_ongoing',
  schoolName: 'Escola Municipal Papa João XXIII',
  referenceUnit: 'UBS Bairro Alto',
  clinicalHistory: 'Gestação a termo (39 semanas), parto cesáreo.',
  surgicalHistory: 'Adenoidectomia em 2022, sem intercorrências.',
  familyHistory: 'Primo materno com TEA.',
  habits: 'Dorme por volta das 22h.',
  developmentalMilestones: 'Sentou aos 7 meses e andou aos 16.',
  allergies: 'Alergia a amoxicilina (urticária generalizada).',
  noKnownAllergies: false,
  diagnosis: {
    ptsId: 'pts-2',
    ptsStatus: 'running',
    caseStudyDate: '2026-02-27',
    cid: 'F84.0',
    supportLevel: 2,
    summary: 'Transtorno do espectro autista, com fala funcional limitada.',
    strengths: 'Boa imitação motora, interesse por música.',
    priorityNeeds: [
      'Comunicação funcional: fazer pedidos e pedir ajuda',
      'Participação em atividades em grupo',
    ],
    socialSituation: 'Mora com a mãe e a avó materna.',
  },
  reassessment: { status: 'open', nextReviewAt: '2026-12-03' },
  hasTcle: true,
};
