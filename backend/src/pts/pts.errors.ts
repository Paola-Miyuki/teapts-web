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

export const ptsProposalNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'PTS_NOT_FOUND',
    'Proposta de PTS não encontrada.',
  );
