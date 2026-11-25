import { HttpStatus } from '@nestjs/common';

import { PtsApiError } from '../pts/pts.errors';

export const invalidFrequency = () =>
  new PtsApiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'INVALID_FREQUENCY',
    'Frequência inválida: informe quantidade, período e duração.',
  );

export const activityForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente a equipe do PTS e o administrador podem criar atividades.',
  );

export const activitiesViewForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem acesso às atividades deste PTS.',
  );

export const activityEditForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o autor da atividade sugerida, o responsável do PTS e o administrador podem editá-la.',
  );

export const activityNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'ACTIVITY_NOT_FOUND',
    'Atividade não encontrada.',
  );

export const activityArchiveForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente a equipe do PTS e o administrador podem arquivar atividades.',
  );

export const activityNotArchivable = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'ACTIVITY_NOT_ARCHIVABLE',
    'Atividade rejeitada, concluída ou já arquivada não pode ser arquivada.',
  );

export const activityStatusForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente a equipe do PTS e o administrador podem mudar o estado da atividade.',
  );

export const invalidActivityTransition = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'INVALID_ACTIVITY_TRANSITION',
    'A atividade não está em um estado que permita esta ação.',
  );

export const activityNotEditable = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'ACTIVITY_NOT_EDITABLE',
    'Atividade rejeitada ou arquivada não pode ser editada.',
  );

// Nas recusas abaixo a mensagem vai no próprio erro, que a tela mostra.
const invalidField = (message: string) =>
  new PtsApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message);

export const invalidActivityGoal = () =>
  invalidField('A meta precisa ser do mesmo PTS.');

export const invalidActivityExecutors = () =>
  invalidField('Os profissionais executores precisam ser da equipe do PTS.');

export const executorsNotAllowed = () =>
  invalidField(
    'Profissionais executores só se aplicam quando a equipe executa.',
  );

export const invalidActivityDocuments = () =>
  invalidField('Os documentos precisam ser do paciente do PTS.');

export const invalidActivityAuthor = () =>
  invalidField('O autor da atividade precisa ser da equipe do PTS.');

export const missingVisitPlace = () =>
  invalidField('Informe o local da visita.');
