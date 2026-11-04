export type ProfileKind = 'admin' | 'professional' | 'patient' | 'waiting';

export type PermissionAction =
  | 'viewHome'
  | 'viewWaitingHome'
  | 'viewOwnCare'
  | 'viewOwnAccount'
  | 'updateOwnAccount'
  | 'changeOwnPassword'
  | 'logout'
  | 'deactivateAccount'
  | 'createPatientProfile'
  | 'viewAuthorizedPatients'
  | 'updateSupportContacts'
  | 'viewPatientRegistry'
  | 'viewProfessionalDirectory'
  | 'createProfessionalProfile'
  | 'updateProfessionalProfile'
  | 'deactivateProfessionalProfile'
  | 'viewPtsProposals'
  | 'createPts'
  | 'approvePtsProposal'
  | 'rejectPtsProposal'
  | 'viewActivePts'
  | 'updatePtsSocialSituation'
  | 'startPts'
  | 'editPtsDraft'
  | 'deletePtsDraft'
  | 'viewPtsHistory'
  | 'endPts'
  | 'addPtsProfessional'
  | 'transferPtsResponsibility'
  | 'removePtsProfessional'
  | 'createActivity'
  | 'viewActivities'
  | 'approveActivity'
  | 'rejectActivity'
  | 'recordAttendance'
  | 'editActivity'
  | 'viewAttendances'
  | 'rectifyAttendance'
  | 'archiveActivity'
  | 'initiateDocumentUpload'
  | 'confirmDocument'
  | 'viewMedicalRecord'
  | 'editDocument'
  | 'deleteDocument'
  | 'viewTimeline'
  | 'recordDiagnosticEvaluation'
  | 'recordReevaluation'
  | 'viewEvaluationHistory'
  | 'rectifyEvaluation'
  | 'linkGuardian'
  | 'grantDataSharing'
  | 'viewAccessLinks'
  | 'endGuardianLink'
  | 'revokeDataSharing';

export type PtsStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'RUNNING'
  | 'REJECTED'
  | 'CONCLUDED'
  | 'CANCELLED';

export type PtsPermissionData = {
  status?: PtsStatus | string;
  patientId?: string | null;
  responsibleProfessionalId?: string | null;
  teamProfessionalIds?: readonly string[];
  authorProfessionalId?: string | null;
};

export type PermissionContext = {
  profileKind?: ProfileKind;
  pts?: PtsPermissionData;
  patientId?: string;
  targetAccountId?: string;
  targetProfessionalId?: string;
  activityState?: 'SUGGESTED' | 'RUNNING' | 'REJECTED' | 'ARCHIVED' | string;
  activityAuthorProfessionalId?: string;
  attendanceAuthorProfessionalId?: string;
  documentPatientAccountId?: string;
  evaluationAuthorProfessionalId?: string;
};

export type PermissionUser = {
  accountId: string;
  role: 'admin' | 'user';
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

function isAdmin(user: PermissionUser, kind: ProfileKind) {
  return user.role === 'admin' && kind === 'admin';
}

function isPatient(user: PermissionUser, kind: ProfileKind, patientId?: string) {
  return (
    kind === 'patient' &&
    Boolean(user.patientProfileId) &&
    (!patientId || user.patientProfileId === patientId)
  );
}

function isProfessionalMember(
  user: PermissionUser,
  pts?: PtsPermissionData,
) {
  if (!pts) {
    return false;
  }

  const memberIds = [
    pts.responsibleProfessionalId,
    ...(pts.teamProfessionalIds ?? []),
  ].filter((id): id is string => Boolean(id));

  return user.professionalProfileIds.some((id) => memberIds.includes(id));
}

function isPtsResponsible(user: PermissionUser, pts?: PtsPermissionData) {
  return Boolean(
    pts?.responsibleProfessionalId &&
      user.professionalProfileIds.includes(pts.responsibleProfessionalId),
  );
}

function isPtsActive(pts?: PtsPermissionData) {
  return pts?.status === 'PLANNING' || pts?.status === 'RUNNING';
}

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

export function can(
  user: PermissionUser,
  action: PermissionAction,
  context: PermissionContext = {},
): boolean {
  const kind = context.profileKind ?? getProfileKind(user);
  const admin = isAdmin(user, kind);
  const professional = kind === 'professional';
  const patient = isPatient(user, kind, context.patientId);
  const member = isProfessionalMember(user, context.pts);
  const responsible = isPtsResponsible(user, context.pts);

  switch (action) {
    case 'viewHome':
      // RFAUT002 – somente usuário autenticado.
      return true;
    case 'viewWaitingHome':
      // RFAUT002 – conta autenticada sem perfil aguarda associação administrativa.
      return kind === 'waiting';
    case 'viewOwnCare':
      // RFPTS002/RFPTS004 – somente paciente titular.
      return patient;
    case 'viewOwnAccount':
      // RFAUT004 – somente usuário autenticado na própria conta.
      return true;
    case 'updateOwnAccount':
      // RFAUT004 – somente o titular da própria conta.
      return true;
    case 'changeOwnPassword':
      // RFAUT004 – somente o titular da própria conta.
      return true;
    case 'logout':
      // RFAUT003 – somente usuário autenticado.
      return true;
    case 'deactivateAccount':
      // RFAUT005 – administrador ou titular da conta alvo.
      return admin || context.targetAccountId === user.accountId;
    case 'createPatientProfile':
      // RFPAC001 – somente administrador.
      return admin;
    case 'viewAuthorizedPatients':
      // RFPAC002 – somente profissional com perfil profissional.
      return professional;
    case 'updateSupportContacts':
      // RFPAC003 – administrador ou paciente titular; responsável tutelar fica negado por DP002.
      // TODO(DP002): modelar o responsável tutelar antes de liberar esta ação.
      return admin || patient;
    case 'viewPatientRegistry':
      // RFPAC006 – somente administrador.
      return admin;
    case 'viewProfessionalDirectory':
      // RFPRO001 – qualquer usuário autenticado, com dados minimizados por DP011.
      return true;
    case 'createProfessionalProfile':
      // RFPRO002 – somente administrador.
      return admin;
    case 'updateProfessionalProfile':
      // RFPRO003 – somente administrador.
      return admin;
    case 'deactivateProfessionalProfile':
      // RFPRO004 – somente administrador.
      return admin;
    case 'viewPtsProposals':
      // RFPTS002 – paciente titular ou profissional da proposta.
      return patient || (professional && (!context.pts || member));
    case 'createPts':
      // RFPTS001 – somente profissional pertencente à conta autenticada.
      return professional && user.professionalProfileIds.length > 0;
    case 'approvePtsProposal':
      // RFPTS003 – paciente titular ou responsável tutelar autorizado.
      // TODO(DP002): liberar responsável tutelar somente após modelar o vínculo.
      return patient && context.pts?.status === 'DRAFT';
    case 'rejectPtsProposal':
      // RFPTS003 – paciente titular ou responsável tutelar autorizado.
      // TODO(DP002): liberar responsável tutelar somente após modelar o vínculo.
      return patient && context.pts?.status === 'DRAFT';
    case 'viewActivePts':
      // RFPTS004 – paciente titular ou profissional autorizado ao PTS ativo.
      return (
        (patient || (professional && member)) && isPtsActive(context.pts)
      );
    case 'updatePtsSocialSituation':
      // RFPTS005 – profissional autorizado em PTS ativo.
      return professional && member && isPtsActive(context.pts);
    case 'startPts':
      // RFPTS006 – responsável do PTS em PLANNING.
      return responsible && context.pts?.status === 'PLANNING';
    case 'editPtsDraft':
      // RFPTS007 – responsável do PTS em DRAFT.
      return responsible && context.pts?.status === 'DRAFT';
    case 'deletePtsDraft':
      // RFPTS008 – responsável do PTS em DRAFT.
      return responsible && context.pts?.status === 'DRAFT';
    case 'viewPtsHistory':
      // RFPTS009 – paciente titular ou profissional autorizado.
      return patient || (professional && (!context.pts || member));
    case 'endPts':
      // RFPTS010 – responsável do PTS em PLANNING ou RUNNING.
      return (
        responsible &&
        (context.pts?.status === 'PLANNING' ||
          context.pts?.status === 'RUNNING')
      );
    case 'addPtsProfessional':
      // RFEM001 – somente responsável do PTS.
      return responsible && Boolean(context.pts);
    case 'transferPtsResponsibility':
      // RFEM002 – somente responsável do PTS.
      return responsible && Boolean(context.targetProfessionalId);
    case 'removePtsProfessional':
      // RFEM003 – somente responsável do PTS.
      return responsible && Boolean(context.targetProfessionalId);
    case 'createActivity':
      // RFACT001 – profissional membro da equipe em PTS ativo.
      return professional && member && isPtsActive(context.pts);
    case 'viewActivities':
      // RFACT002 – paciente titular ou profissional autorizado.
      return patient || (professional && member);
    case 'approveActivity':
      // RFACT003 – responsável do PTS em atividade SUGGESTED.
      return responsible && context.activityState === 'SUGGESTED';
    case 'rejectActivity':
      // RFACT003 – responsável do PTS em atividade SUGGESTED.
      return responsible && context.activityState === 'SUGGESTED';
    case 'recordAttendance':
      // RFACT004 – profissional membro em atividade RUNNING.
      return professional && member && context.activityState === 'RUNNING';
    case 'editActivity':
      // RFACT005 – autor em SUGGESTED ou responsável em SUGGESTED/RUNNING.
      return (
        (professional &&
          context.activityAuthorProfessionalId !== undefined &&
          user.professionalProfileIds.includes(
            context.activityAuthorProfessionalId,
          ) &&
          context.activityState === 'SUGGESTED') ||
        (responsible &&
          (context.activityState === 'SUGGESTED' ||
            context.activityState === 'RUNNING'))
      );
    case 'viewAttendances':
      // RFACT006 – paciente titular ou profissional autorizado.
      return patient || (professional && member);
    case 'rectifyAttendance':
      // RFACT007 – somente autor do atendimento.
      return (
        professional &&
        context.attendanceAuthorProfessionalId !== undefined &&
        user.professionalProfileIds.includes(
          context.attendanceAuthorProfessionalId,
        )
      );
    case 'archiveActivity':
      // RFACT008 – responsável do PTS em SUGGESTED ou RUNNING.
      return (
        responsible &&
        (context.activityState === 'SUGGESTED' ||
          context.activityState === 'RUNNING')
      );
    case 'initiateDocumentUpload':
      // RFDOC001 – usuário autorizado ao prontuário.
      return (
        patient ||
        (professional && member)
      );
    case 'confirmDocument':
      // RFDOC002 – usuário autorizado ao prontuário.
      return (
        patient ||
        (professional && member)
      );
    case 'viewMedicalRecord':
      // RFDOC003 – paciente titular ou profissional autorizado.
      return (
        patient ||
        (professional &&
          context.documentPatientAccountId === user.accountId)
      );
    case 'editDocument':
      // RFDOC005 – usuário autorizado ao prontuário.
      return (
        patient ||
        (professional &&
          context.documentPatientAccountId === user.accountId)
      );
    case 'deleteDocument':
      // RFDOC006 – usuário autorizado, sujeito à DP009.
      // TODO(DP009): definir quem pode excluir e a política de retenção.
      return false;
    case 'viewTimeline':
      // RFTL001 – usuário autorizado ao PTS.
      return patient || (professional && member);
    case 'recordDiagnosticEvaluation':
      // RFEVA001 – profissional autorizado.
      return professional && member;
    case 'recordReevaluation':
      // RFEVA002 – profissional autorizado.
      return professional && member;
    case 'viewEvaluationHistory':
      // RFEVA003 – paciente titular ou profissional autorizado.
      return patient || (professional && member);
    case 'rectifyEvaluation':
      // RFEVA004 – autor da avaliação.
      return (
        professional &&
        context.evaluationAuthorProfessionalId !== undefined &&
        user.professionalProfileIds.includes(
          context.evaluationAuthorProfessionalId,
        )
      );
    case 'linkGuardian':
      // RFACL001 – responsável tutelar depende de DP002.
      // TODO(DP002): definir modelo e validação do responsável tutelar.
      return false;
    case 'grantDataSharing':
      // RFACL002 – paciente ou responsável tutelar autorizado.
      // TODO(DP002): liberar responsável tutelar após definir o vínculo.
      return patient;
    case 'viewAccessLinks':
      // RFACL003 – paciente, responsável tutelar ou administrador.
      // TODO(DP002): liberar responsável tutelar após definir o vínculo.
      return admin || patient;
    case 'endGuardianLink':
      // RFACL004 – somente administrador.
      return admin;
    case 'revokeDataSharing':
      // RFACL005 – paciente ou responsável tutelar autorizado.
      // TODO(DP002): liberar responsável tutelar após definir o vínculo.
      return patient;
  }
}
