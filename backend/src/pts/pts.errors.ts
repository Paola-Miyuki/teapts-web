import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Erro da API no formato do contrato: { status: <CÓDIGO>, message: <texto> }.
 * O front lê `status` como código e `message` como texto.
 */
export class PtsApiError extends HttpException {
  constructor(
    httpStatus: HttpStatus,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ status: code, message, ...extra }, httpStatus);
  }
}

export const validationError = (errors: FieldError[]) =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'Dados inválidos na solicitação.',
    { errors },
  );

export const professionalNotAuthorized = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'PROFESSIONAL_NOT_AUTHORIZED',
    'Você não tem autorização para usar o perfil profissional informado.',
  );

export const patientNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'PATIENT_NOT_FOUND',
    'Paciente não encontrado.',
  );

export const ptsActiveExists = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_ACTIVE_EXISTS',
    'O paciente já possui um PTS aprovado e ativo.',
  );

export const teamProfessionalNotFound = (ids: string[]) =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'TEAM_PROFESSIONAL_NOT_FOUND',
    `Profissionais da equipe não encontrados: ${ids.join(', ')}.`,
    { professionalIds: ids },
  );

export const ptsProposalForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem acesso às propostas deste paciente.',
  );

export const ptsProposalEditForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o responsável pode editar a proposta.',
  );

export const ptsSheetForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente a equipe do PTS e o administrador podem alterar a ficha.',
  );

export const ptsProposalNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'PTS_NOT_FOUND',
    'Proposta de PTS não encontrada.',
  );

export const activePtsForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem acesso ao PTS ativo deste paciente.',
  );

export const activePtsNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'ACTIVE_PTS_NOT_FOUND',
    'O paciente não possui PTS ativo.',
  );

export const ptsProposalNotDraft = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_DRAFT',
    'Somente propostas aguardando decisão podem ser editadas.',
  );

export const ptsProposalNotPending = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_DRAFT',
    'A proposta não está mais aguardando decisão.',
  );

export const activePtsAlreadyExists = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'ACTIVE_PTS_ALREADY_EXISTS',
    'O paciente já possui um PTS aprovado e ativo.',
  );

export const ptsForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem acesso a este PTS.',
  );

export const ptsHistoryForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem acesso ao histórico deste paciente.',
  );

export const ptsNotFound = () =>
  new PtsApiError(HttpStatus.NOT_FOUND, 'PTS_NOT_FOUND', 'PTS não encontrado.');

export const ptsNotActive = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_ACTIVE',
    'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
  );

export const ptsStartForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o responsável pode iniciar a execução do PTS.',
  );

export const ptsNotPlanning = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_PLANNING',
    'Só um PTS em planejamento pode ter a execução iniciada.',
  );

export const ptsCloseForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o responsável pode encerrar o PTS.',
  );

export const ptsCloseNotActive = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_ACTIVE',
    'Só um PTS em planejamento ou em andamento pode ser encerrado.',
  );

export const ptsProposalDeleteForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o responsável pode excluir a proposta.',
  );

export const ptsProposalNotDraftForDelete = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_DRAFT',
    'Somente propostas aguardando decisão podem ser excluídas.',
  );

export const teamEditForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o responsável pode alterar a equipe do PTS.',
  );

export const teamMemberNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'TEAM_MEMBER_NOT_FOUND',
    'O profissional não faz parte da equipe deste PTS.',
  );

export const cannotRemoveResponsible = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'CANNOT_REMOVE_RESPONSIBLE',
    'O responsável não pode ser removido da equipe. Transfira a responsabilidade antes.',
  );

export const teamDuplicateAccount = (ids: string[]) =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'TEAM_DUPLICATE_ACCOUNT',
    'A equipe não pode ter mais de um perfil da mesma conta, contando o responsável.',
    { professionalIds: ids },
  );

export const newResponsibleNotFound = () =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'NEW_RESPONSIBLE_NOT_FOUND',
    'O profissional indicado para assumir a responsabilidade não está cadastrado.',
  );

export const newResponsibleInvalid = () =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'NEW_RESPONSIBLE_INVALID',
    'O profissional indicado para assumir a responsabilidade é inválido ou já é o responsável atual.',
  );

export const goalForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente a equipe do PTS e o administrador podem alterar as metas.',
  );

export const goalNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'GOAL_NOT_FOUND',
    'Meta não encontrada.',
  );

export const ptsNotEditable = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_EDITABLE',
    'O PTS só pode ser alterado em proposta, em planejamento ou em andamento.',
  );

export const lastGoal = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'LAST_GOAL',
    'O PTS precisa ter ao menos uma meta.',
  );

export const goalHasActivities = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'GOAL_HAS_ACTIVITIES',
    'A meta tem atividades ligadas. Desligue as atividades antes de excluir.',
  );
