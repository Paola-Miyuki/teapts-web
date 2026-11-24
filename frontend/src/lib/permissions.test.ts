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

  it('restringe a administração de contas ao admin', () => {
    expect(can(admin, 'manageAccounts')).toBe(true);
    expect(can(professional, 'manageAccounts')).toBe(false);
    expect(can(patient, 'manageAccounts')).toBe(false);
    expect(can(waiting, 'manageAccounts')).toBe(false);
  });

  it('libera pacientes autorizados e criação de PTS ao profissional e ao admin', () => {
    for (const action of ['viewAuthorizedPatients', 'createPts'] as const) {
      expect(can(professional, action)).toBe(true);
      expect(can(admin, action)).toBe(true);
      expect(can(patient, action)).toBe(false);
      expect(can(waiting, action)).toBe(false);
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
    expect(can(admin, 'viewPtsProposals')).toBe(true);
    expect(can(admin, 'viewPtsProposals', { pts: draft })).toBe(true);
    expect(can(waiting, 'viewPtsProposals')).toBe(false);
  });

  it('libera o PTS ativo ao paciente, ao profissional e ao admin', () => {
    expect(can(patient, 'viewActivePts')).toBe(true);
    expect(can(professional, 'viewActivePts')).toBe(true);
    expect(can(admin, 'viewActivePts')).toBe(true);
    expect(can(waiting, 'viewActivePts')).toBe(false);
  });

  it('mantém a situação social oculta para o paciente', () => {
    expect(can(professional, 'viewPtsSocialSituation')).toBe(true);
    expect(can(admin, 'viewPtsSocialSituation')).toBe(true);
    expect(can(patient, 'viewPtsSocialSituation')).toBe(false);
  });

  it('deixa só a equipe e o admin editarem a situação social', () => {
    const active = {
      status: 'planning',
      responsibleProfessionalId: 'responsible-id',
      teamProfessionalIds: ['professional-id'],
    };

    expect(can(professional, 'editPtsSocialSituation', { pts: active })).toBe(
      true,
    );
    expect(
      can(professional, 'editPtsSocialSituation', {
        pts: { ...active, teamProfessionalIds: [] },
      }),
    ).toBe(false);
    expect(can(professional, 'editPtsSocialSituation')).toBe(false);
    expect(can(admin, 'editPtsSocialSituation', { pts: active })).toBe(true);
    expect(can(patient, 'editPtsSocialSituation', { pts: active })).toBe(false);
    expect(can(waiting, 'editPtsSocialSituation', { pts: active })).toBe(false);
  });

  it('deixa o paciente e o admin decidirem, e só proposta em draft', () => {
    for (const action of ['approvePtsProposal', 'rejectPtsProposal'] as const) {
      expect(can(patient, action, { pts: draft })).toBe(true);
      expect(
        can(patient, action, { pts: { ...draft, status: 'planning' } }),
      ).toBe(false);
      expect(can(professional, action, { pts: draft })).toBe(false);
      expect(can(admin, action, { pts: draft })).toBe(true);
      expect(
        can(admin, action, { pts: { ...draft, status: 'planning' } }),
      ).toBe(false);
      expect(can(admin, action)).toBe(false);
      expect(can(waiting, action, { pts: draft })).toBe(false);
    }
  });

  it('libera ao admin toda ação, menos as que só escolhem o início', () => {
    expect(can(admin, 'viewOwnCare')).toBe(false);
    expect(can(admin, 'viewWaitingHome')).toBe(false);

    for (const action of [
      'createPatientProfile',
      'viewAuthorizedPatients',
      'viewPatientRegistry',
      'viewProfessionalDirectory',
      'viewPtsProposals',
      'viewPtsSocialSituation',
      'createPts',
    ] as const) {
      expect(can(admin, action)).toBe(true);
    }
  });
});

describe('editPtsProposal', () => {
  const draft = (responsibleProfessionalId: string) => ({
    pts: { status: 'draft', responsibleProfessionalId },
  });

  const prof = {
    accountId: 'a',
    role: 'user' as const,
    patientProfileId: null,
    professionalProfileIds: ['p1'],
  };

  it('libera ao responsável só em draft', () => {
    expect(can(prof, 'editPtsProposal', draft('p1'))).toBe(true);
    expect(can(prof, 'editPtsProposal', draft('p2'))).toBe(false);
    expect(
      can(prof, 'editPtsProposal', {
        pts: { status: 'planning', responsibleProfessionalId: 'p1' },
      }),
    ).toBe(false);
  });

  it('libera ao admin em draft, mesmo sem ser o responsável', () => {
    const admin = {
      ...prof,
      role: 'admin' as const,
      professionalProfileIds: [],
    };

    expect(can(admin, 'editPtsProposal', draft('p2'))).toBe(true);
    expect(can(admin, 'editPtsProposal', { pts: { status: 'running' } })).toBe(
      false,
    );
  });
});

describe('manageSupportContacts', () => {
  it('libera ao admin sempre', () => {
    expect(can(admin, 'manageSupportContacts')).toBe(true);
  });

  it('libera ao profissional só com PTS ativo, e nega com PTS encerrado', () => {
    expect(
      can(professional, 'manageSupportContacts', { patientReadOnly: false }),
    ).toBe(true);
    expect(
      can(professional, 'manageSupportContacts', { patientReadOnly: true }),
    ).toBe(false);
    expect(can(professional, 'manageSupportContacts')).toBe(false);
  });

  it('nega ao paciente e à conta sem perfil', () => {
    expect(
      can(patient, 'manageSupportContacts', { patientReadOnly: false }),
    ).toBe(false);
    expect(
      can(waiting, 'manageSupportContacts', { patientReadOnly: false }),
    ).toBe(false);
  });
});

describe('removePtsTeamMember', () => {
  const pts = (status: string, responsibleProfessionalId: string) => ({
    pts: { status, responsibleProfessionalId },
  });

  const prof = {
    accountId: 'a',
    role: 'user' as const,
    patientProfileId: null,
    professionalProfileIds: ['p1'],
  };

  it('libera ao responsável com o PTS em planejamento ou execução', () => {
    expect(can(prof, 'removePtsTeamMember', pts('planning', 'p1'))).toBe(true);
    expect(can(prof, 'removePtsTeamMember', pts('running', 'p1'))).toBe(true);
    expect(can(prof, 'removePtsTeamMember', pts('draft', 'p1'))).toBe(false);
    expect(can(prof, 'removePtsTeamMember', pts('running', 'p2'))).toBe(false);
  });

  it('não libera ao paciente nem à conta sem perfil', () => {
    const patient = {
      ...prof,
      patientProfileId: 'patient-id',
      professionalProfileIds: [],
    };

    const waiting = {
      ...prof,
      professionalProfileIds: [],
    };

    expect(can(patient, 'removePtsTeamMember', pts('running', 'p1'))).toBe(
      false,
    );
    expect(can(waiting, 'removePtsTeamMember', pts('running', 'p1'))).toBe(
      false,
    );
  });

  it('libera ao admin', () => {
    const admin = {
      ...prof,
      role: 'admin' as const,
      professionalProfileIds: [],
    };

    expect(can(admin, 'removePtsTeamMember', pts('running', 'p2'))).toBe(true);
  });
});

describe('deletePtsProposal', () => {
  const pts = (status: string, responsibleProfessionalId: string) => ({
    pts: { status, responsibleProfessionalId },
  });

  const prof = {
    accountId: 'a',
    role: 'user' as const,
    patientProfileId: null,
    professionalProfileIds: ['p1'],
  };

  it('libera ao responsável só em draft', () => {
    expect(can(prof, 'deletePtsProposal', pts('draft', 'p1'))).toBe(true);
    expect(can(prof, 'deletePtsProposal', pts('draft', 'p2'))).toBe(false);
    expect(can(prof, 'deletePtsProposal', pts('planning', 'p1'))).toBe(false);
  });

  it('não libera ao paciente', () => {
    const patient = {
      ...prof,
      patientProfileId: 'patient-id',
      professionalProfileIds: [],
    };

    expect(can(patient, 'deletePtsProposal', pts('draft', 'p1'))).toBe(false);
  });

  it('libera ao admin em draft', () => {
    const admin = {
      ...prof,
      role: 'admin' as const,
      professionalProfileIds: [],
    };

    expect(can(admin, 'deletePtsProposal', pts('draft', 'p2'))).toBe(true);
    expect(can(admin, 'deletePtsProposal', pts('running', 'p2'))).toBe(false);
  });
});
