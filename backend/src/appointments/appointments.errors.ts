import { HttpStatus } from '@nestjs/common';

import { PtsApiError } from '../pts/pts.errors';

export const appointmentForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente a equipe do PTS e o administrador podem registrar atendimentos.',
  );

export const activityNotRunning = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'ACTIVITY_NOT_RUNNING',
    'Só uma atividade em andamento recebe atendimento.',
  );

export const appointmentPtsNotActive = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_ACTIVE',
    'Só um PTS em planejamento ou em andamento recebe atendimento.',
  );

const invalidField = (message: string) =>
  new PtsApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message);

export const incompleteAppointment = () =>
  invalidField(
    'Preencha a hora de término e os quatro campos do SOAP no atendimento realizado.',
  );

export const soapNotAllowed = () =>
  invalidField('Falta e desmarcação não têm SOAP.');

export const invalidAppointmentAuthor = () =>
  invalidField('O autor do atendimento precisa ser da equipe do PTS.');

export const invalidAppointmentEnd = () =>
  invalidField('A hora de término precisa ser depois da hora de início.');

export const futureAppointment = () =>
  invalidField('Atendimento realizado ou falta não pode ter data futura.');
