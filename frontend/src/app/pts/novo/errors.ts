import { ApiError } from './api/http';

export type CreatePtsErrorKind =
  | 'unauthorized-profile'
  | 'active-exists'
  | 'session-expired'
  | 'network'
  | 'generic';

export interface CreatePtsError {
  kind: CreatePtsErrorKind;
  title: string;
  message: string;
}

const UNAUTHORIZED_CODES = new Set([
  'PROFESSIONAL_NOT_AUTHORIZED',
  'FORBIDDEN',
]);

export function mapCreatePtsError(err: unknown): CreatePtsError {
  const api = err instanceof ApiError ? err : null;

  if (api?.code === 'PTS_ACTIVE_EXISTS') {
    return {
      kind: 'active-exists',
      title: 'Este paciente já tem um PTS ativo',
      message:
        'O paciente já possui um PTS aprovado e ativo. Selecione outro paciente.',
    };
  }

  if (api?.code === 'PATIENT_NOT_FOUND') {
    return {
      kind: 'generic',
      title: 'Paciente não encontrado',
      message:
        'Não foi possível localizar o paciente selecionado. Atualize a lista e tente novamente.',
    };
  }

  if (api?.code === 'TEAM_PROFESSIONAL_NOT_FOUND') {
    return {
      kind: 'generic',
      title: 'Profissional da equipe inválido',
      message:
        'Um ou mais profissionais selecionados não foram encontrados. Atualize a lista da equipe e tente novamente.',
    };
  }

  if (
    api &&
    (api.httpStatus === 403 ||
      (api.code !== undefined && UNAUTHORIZED_CODES.has(api.code)))
  ) {
    return {
      kind: 'unauthorized-profile',
      title: 'Perfil sem autorização',
      message:
        'Você não tem autorização para criar propostas com este perfil profissional. Entre com o perfil correto ou procure o administrador.',
    };
  }

  if (api?.httpStatus === 401) {
    return {
      kind: 'session-expired',
      title: 'Sessão expirada',
      message: 'Sua sessão expirou. Entre novamente para criar a proposta.',
    };
  }

  if (api?.httpStatus === 0) {
    return {
      kind: 'network',
      title: 'Sem conexão',
      message:
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    };
  }

  return {
    kind: 'generic',
    title: 'Não foi possível criar a proposta',
    message:
      api?.message ||
      'Ocorreu um erro inesperado. Tente novamente em instantes.',
  };
}
