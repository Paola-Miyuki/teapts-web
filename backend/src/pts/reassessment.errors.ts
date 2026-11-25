import { HttpStatus } from '@nestjs/common';

import { PtsApiError } from './pts.errors';

export const reassessmentForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Somente o responsável e o administrador podem registrar a reavaliação.',
  );

export const reassessmentNotRunning = () =>
  new PtsApiError(
    HttpStatus.CONFLICT,
    'PTS_NOT_RUNNING',
    'Só um PTS em andamento pode ser reavaliado.',
  );

/** Ex.: "Faltam 2 metas sem resultado." */
export const goalsWithoutResult = (missing: number) =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'GOALS_WITHOUT_RESULT',
    missing === 1
      ? 'Falta 1 meta sem resultado.'
      : `Faltam ${missing} metas sem resultado.`,
    { missing },
  );

export const reassessmentGoalsInvalid = () =>
  new PtsApiError(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'As metas avaliadas precisam ser deste PTS, sem repetir.',
  );
