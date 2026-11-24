// Matriz de permissões da interface (#103), por perfil e contexto do PTS.
// Esconder botão ou menu não é segurança: a API também bloqueia (403).
// Ações de telas que ainda não existem entram aqui junto com a tela.

export type ProfileKind = 'admin' | 'professional' | 'patient' | 'waiting';

export type PermissionAction =
  | 'viewWaitingHome'
  | 'viewOwnCare'
  | 'createPatientProfile'
  | 'manageSupportContacts'
  | 'manageClinicalData'
  | 'manageMedications'
  | 'viewAuthorizedPatients'
  | 'viewPatientRegistry'
  | 'viewProfessionalDirectory'
  | 'manageAccounts'
  | 'viewPtsProposals'
  | 'viewPts'
  | 'viewActivePts'
  | 'viewPtsSocialSituation'
  | 'editPtsSocialSituation'
  | 'removePtsTeamMember'
  | 'createPts'
  | 'approvePtsProposal'
  | 'rejectPtsProposal'
  | 'editPtsProposal'
  | 'deletePtsProposal';

// Mesmos valores do PtsStateEnum da API.
export type PtsStatus =
  'draft' | 'planning' | 'running' | 'rejected' | 'concluded' | 'cancelled';

export type PtsPermissionData = {
  status?: PtsStatus | string;
  responsibleProfessionalId?: string | null;
  teamProfessionalIds?: readonly string[];
};

export type PermissionContext = {
  pts?: PtsPermissionData;
  // O profissional só tem PTS encerrado com o paciente (`readOnly` da API).
  patientReadOnly?: boolean;
};

export type PermissionUser = {
  accountId: string;
  role: 'admin' | 'user';
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

export function getProfileKind(account: PermissionUser): ProfileKind {
  if (account.role === 'admin') {
    return 'admin';
  }

  if (account.professionalProfileIds.length > 0) {
    return 'professional';
  }

  if (account.patientProfileId) {
    return 'patient';
  }

  return 'waiting';
}

function isProposalMember(user: PermissionUser, pts: PtsPermissionData) {
  const memberIds = [
    pts.responsibleProfessionalId,
    ...(pts.teamProfessionalIds ?? []),
  ];

  return user.professionalProfileIds.some((id) => memberIds.includes(id));
}

export function can(
  user: PermissionUser,
  action: PermissionAction,
  context: PermissionContext = {},
): boolean {
  const kind = getProfileKind(user);
  const admin = kind === 'admin';
  const professional = kind === 'professional';
  const patient = kind === 'patient';
  const { pts } = context;

  // RN022 – o administrador acessa todo o sistema. Ficam de fora o que só
  // escolhe o início (paciente e conta sem perfil) e a regra de estado:
  // aprovar, rejeitar e editar seguem valendo só em DRAFT.
  if (admin) {
    switch (action) {
      case 'viewOwnCare':
      case 'viewWaitingHome':
        return false;
      case 'approvePtsProposal':
      case 'rejectPtsProposal':
      case 'editPtsProposal':
      case 'deletePtsProposal':
        return pts?.status === 'draft';
      default:
        return true;
    }
  }

  switch (action) {
    case 'viewWaitingHome':
      // RFAUT002 – conta sem perfil aguarda a associação pelo administrador.
      return kind === 'waiting';
    case 'viewOwnCare':
      // RFPTS002/RFPTS004 – paciente titular.
      return patient;
    case 'createPatientProfile':
      // RFPAC001 – administrador.
      return admin;
    case 'manageSupportContacts':
      // RFPAC003, RN024 – administrador (RN022) ou profissional membro de PTS
      // ativo do paciente; o paciente só vê os próprios contatos. Contato de
      // suporte não concede acesso (RN017).
      return professional && context.patientReadOnly === false;

    case 'manageClinicalData':
      // RFPAC007, RN024 – administrador (RN022) ou profissional membro da
      // equipe de um PTS ativo do paciente.
      return professional && context.patientReadOnly === false;

    case 'manageMedications':
      // RFPAC007, RN024 – administrador (RN022) ou profissional membro da
      // equipe de um PTS ativo do paciente.
      return professional && context.patientReadOnly === false;
    case 'viewAuthorizedPatients':
      // RFPAC002 – profissional (a API filtra os vinculados).
      return professional;
    case 'viewPatientRegistry':
      // RFPAC006 – administrador.
      return admin;
    case 'manageAccounts':
      // RN032 – só o administrador lista, consulta e desativa contas.
      return admin;
    case 'viewProfessionalDirectory':
      // RFPRO001 – profissional; administrador só para seleção.
      return admin || professional;
    case 'viewPtsProposals':
      // RFPTS002 – paciente titular ou profissional da proposta.
      return patient || (professional && (!pts || isProposalMember(user, pts)));
    case 'viewPts':
      // RFPTS009, RFTL001 – equipe ou paciente titular; a API confere o vínculo.
      return professional || patient;
    case 'viewActivePts':
      // RFPTS004 – paciente titular ou profissional (a API confere a equipe).
      return patient || professional;
    case 'viewPtsSocialSituation':
      // DP003 – oculta para o paciente até a decisão.
      return professional;
    case 'editPtsSocialSituation':
      // RFPTS005 – profissional da equipe (responsável ou membro).
      return professional && pts !== undefined && isProposalMember(user, pts);

    case 'removePtsTeamMember':
      // RFEM003 – profissional responsável, com o PTS em planejamento ou execução.
      return (
        professional &&
        ['planning', 'running'].includes(pts?.status?.toLowerCase() ?? '') &&
        user.professionalProfileIds.includes(
          pts?.responsibleProfessionalId ?? '',
        )
      );
    case 'createPts':
      // RFPTS001 – profissional.
      return professional;
    case 'approvePtsProposal':
    case 'rejectPtsProposal':
      // RFPTS003 – paciente titular, só em DRAFT. O responsável tutelar não
      // é ator do sistema (RN025).
      return patient && pts?.status === 'draft';
    case 'editPtsProposal':
    case 'deletePtsProposal':
      // RFPTS005 – profissional responsável, só em DRAFT.
      return (
        professional &&
        pts?.status === 'draft' &&
        user.professionalProfileIds.includes(
          pts.responsibleProfessionalId ?? '',
        )
      );
  }
}
