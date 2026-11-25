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
  | 'uploadDocument'
  | 'viewPatientDocuments'
  | 'createProfessional'
  | 'manageAccounts'
  | 'viewNotifications'
  | 'viewPtsProposals'
  | 'viewPts'
  | 'viewActivePts'
  | 'viewPtsSheet'
  | 'editPts'
  | 'manageGoals'
  | 'createActivity'
  | 'removePtsTeamMember'
  | 'createPts'
  | 'approvePtsProposal'
  | 'rejectPtsProposal'
  | 'editPtsProposal'
  | 'deletePtsProposal'
  | 'startPts'
  | 'closePts'
  | 'registerPtsReassessment';

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

function isActivePts(pts?: PtsPermissionData) {
  return ['planning', 'running'].includes(pts?.status?.toLowerCase() ?? '');
}

function isEditablePts(pts?: PtsPermissionData) {
  return pts?.status?.toLowerCase() === 'draft' || isActivePts(pts);
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
  // aprovar, rejeitar e editar seguem valendo só em DRAFT; iniciar, só em
  // PLANNING; reavaliar, só em RUNNING.
  if (admin) {
    switch (action) {
      case 'viewOwnCare':
      case 'viewWaitingHome':
      case 'viewNotifications':
        return false;
      case 'approvePtsProposal':
      case 'rejectPtsProposal':
      case 'editPtsProposal':
      case 'deletePtsProposal':
        return pts?.status === 'draft';
      case 'startPts':
        return pts?.status === 'planning';
      case 'registerPtsReassessment':
        return pts?.status === 'running';
      case 'editPts':
      case 'closePts':
        return isActivePts(pts);
      case 'manageGoals':
      case 'createActivity':
        return isEditablePts(pts);
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
    case 'viewNotifications':
      // RFNOT002 – profissional e paciente; o admin não recebe.
      return professional || patient;
    case 'createProfessional':
      // RFPRO002 – só o administrador cria o perfil profissional.
      return admin;
    case 'uploadDocument':
      // RFDOC001, RN028 – o paciente envia os próprios documentos (a API
      // confere o id); o profissional, só com PTS ativo do paciente.
      return patient || (professional && context.patientReadOnly === false);
    case 'viewPatientDocuments':
      // RFDOC003, RN028 – admin (RN022) e profissional vinculado (a API
      // confere o vínculo); o paciente não vê os documentos da equipe.
      return professional;
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
    case 'viewPtsSheet':
      // RN028 – a ficha (diagnóstico, perfil, vulnerabilidades e situação
      // social) não aparece ao paciente.
      return professional;
    case 'editPts':
      // RFPTS005 – equipe do PTS (responsável ou membro) ou admin, com o PTS
      // em planejamento ou execução; o paciente não edita.
      return (
        professional &&
        pts !== undefined &&
        isActivePts(pts) &&
        isProposalMember(user, pts)
      );

    case 'manageGoals':
    case 'createActivity':
      // RFPTS012, RFACT001 – equipe do PTS, em proposta, planejamento ou
      // andamento; o paciente só vê.
      return (
        professional &&
        pts !== undefined &&
        isEditablePts(pts) &&
        isProposalMember(user, pts)
      );

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
    case 'startPts':
      // RFPTS006 – profissional responsável, só em planejamento.
      return (
        professional &&
        pts?.status === 'planning' &&
        user.professionalProfileIds.includes(
          pts.responsibleProfessionalId ?? '',
        )
      );
    case 'closePts':
      // RFPTS010 – profissional responsável, em planejamento ou andamento.
      return (
        professional &&
        isActivePts(pts) &&
        user.professionalProfileIds.includes(
          pts?.responsibleProfessionalId ?? '',
        )
      );
    case 'registerPtsReassessment':
      // RFEVA005 – profissional responsável, só em andamento.
      return (
        professional &&
        pts?.status === 'running' &&
        user.professionalProfileIds.includes(
          pts.responsibleProfessionalId ?? '',
        )
      );
  }
}
