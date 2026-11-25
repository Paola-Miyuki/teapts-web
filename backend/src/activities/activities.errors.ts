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
