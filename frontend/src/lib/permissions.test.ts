import { can, type PermissionUser } from './permissions';

const admin: PermissionUser = {
  accountId: 'admin-account',
  role: 'admin',
  patientProfileId: null,
  professionalProfileIds: [],
};

const professional: PermissionUser = {
  accountId: 'professional-account',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: ['professional-id'],
};

const patient: PermissionUser = {
  accountId: 'patient-account',
  role: 'user',
  patientProfileId: 'patient-id',
  professionalProfileIds: [],
};

const waiting: PermissionUser = {
  accountId: 'waiting-account',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: [],
};

const draft = {
  status: 'draft',
  responsibleProfessionalId: 'responsible-id',
  teamProfessionalIds: ['professional-id'],
};

describe('can', () => {
  it('restringe o cadastro e a lista de pacientes ao admin', () => {
    for (const action of [
      'viewPatientRegistry',
      'createPatientProfile',
    ] as const) {
      expect(can(admin, action)).toBe(true);
      expect(can(professional, action)).toBe(false);
      expect(can(patient, action)).toBe(false);
      expect(can(waiting, action)).toBe(false);
    }
  });

  it('libera pacientes autorizados e criação de PTS só ao profissional', () => {
    for (const action of ['viewAuthorizedPatients', 'createPts'] as const) {
      expect(can(professional, action)).toBe(true);
      expect(can(admin, action)).toBe(false);
      expect(can(patient, action)).toBe(false);
    }
  });

  it('esconde o diretório de profissionais do paciente e da conta sem perfil', () => {
    expect(can(admin, 'viewProfessionalDirectory')).toBe(true);
    expect(can(professional, 'viewProfessionalDirectory')).toBe(true);
    expect(can(patient, 'viewProfessionalDirectory')).toBe(false);
    expect(can(waiting, 'viewProfessionalDirectory')).toBe(false);
  });

  it('mostra propostas ao paciente e aos profissionais da proposta', () => {
    expect(can(patient, 'viewPtsProposals')).toBe(true);
    expect(can(professional, 'viewPtsProposals', { pts: draft })).toBe(true);
    expect(
      can(professional, 'viewPtsProposals', {
        pts: { ...draft, teamProfessionalIds: [] },
      }),
    ).toBe(false);
    expect(can(admin, 'viewPtsProposals')).toBe(false);
  });

  it('mantém a situação social oculta para o paciente (DP003)', () => {
    expect(can(professional, 'viewPtsSocialSituation')).toBe(true);
    expect(can(patient, 'viewPtsSocialSituation')).toBe(false);
  });

  it('deixa só o paciente decidir, e só proposta em draft', () => {
    for (const action of ['approvePtsProposal', 'rejectPtsProposal'] as const) {
      expect(can(patient, action, { pts: draft })).toBe(true);
      expect(
        can(patient, action, { pts: { ...draft, status: 'planning' } }),
      ).toBe(false);
      expect(can(professional, action, { pts: draft })).toBe(false);
      expect(can(admin, action, { pts: draft })).toBe(false);
    }
  });
});
