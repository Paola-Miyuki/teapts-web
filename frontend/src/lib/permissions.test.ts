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
  status: 'DRAFT' as const,
  patientId: 'patient-id',
  responsibleProfessionalId: 'professional-id',
  teamProfessionalIds: ['professional-id', 'other-professional'],
};

describe('can', () => {
  it('aplica permissões básicas por perfil', () => {
    expect(can(admin, 'viewPatientRegistry')).toBe(true);
    expect(can(patient, 'viewPatientRegistry')).toBe(false);
    expect(can(professional, 'viewAuthorizedPatients')).toBe(true);
    expect(can(patient, 'viewAuthorizedPatients')).toBe(false);
    expect(can(patient, 'viewPtsProposals')).toBe(true);
    expect(can(admin, 'viewPtsProposals')).toBe(false);
    expect(can(waiting, 'viewProfessionalDirectory')).toBe(true);
    expect(can(patient, 'viewProfessionalDirectory')).toBe(true);
  });

  it('protege ações administrativas e do próprio titular', () => {
    expect(can(admin, 'createPatientProfile')).toBe(true);
    expect(can(professional, 'createPatientProfile')).toBe(false);
    expect(can(admin, 'createProfessionalProfile')).toBe(true);
    expect(can(professional, 'createProfessionalProfile')).toBe(false);
    expect(can(admin, 'updateProfessionalProfile')).toBe(true);
    expect(can(professional, 'updateProfessionalProfile')).toBe(false);
    expect(can(admin, 'deactivateProfessionalProfile')).toBe(true);
    expect(can(professional, 'deactivateProfessionalProfile')).toBe(false);
    expect(
      can(patient, 'deactivateAccount', { targetAccountId: 'patient-account' }),
    ).toBe(true);
    expect(
      can(patient, 'deactivateAccount', { targetAccountId: 'other-account' }),
    ).toBe(false);
  });

  it('aplica o contexto do PTS ao responsável e à equipe', () => {
    expect(can(professional, 'editPtsDraft', { pts: draft })).toBe(true);
    expect(can(professional, 'deletePtsDraft', { pts: draft })).toBe(true);
    expect(
      can(professional, 'startPts', { pts: { ...draft, status: 'PLANNING' } }),
    ).toBe(true);
    expect(
      can(professional, 'endPts', { pts: { ...draft, status: 'RUNNING' } }),
    ).toBe(true);
    expect(
      can(professional, 'createActivity', {
        pts: { ...draft, status: 'RUNNING' },
      }),
    ).toBe(true);
    expect(can(patient, 'editPtsDraft', { pts: draft })).toBe(false);
    expect(
      can(professional, 'editPtsDraft', {
        pts: { ...draft, responsibleProfessionalId: 'other-professional' },
      }),
    ).toBe(false);
  });

  it('mantém ações de responsável tutelar negadas enquanto DP002 estiver pendente', () => {
    expect(can(patient, 'linkGuardian')).toBe(false);
    expect(can(patient, 'grantDataSharing')).toBe(true);
    expect(can(patient, 'revokeDataSharing')).toBe(true);
    expect(can(waiting, 'grantDataSharing')).toBe(false);
  });

  it('mantém exclusão de documento negada enquanto DP009 estiver pendente', () => {
    expect(can(patient, 'deleteDocument')).toBe(false);
    expect(can(professional, 'deleteDocument')).toBe(false);
  });
});
