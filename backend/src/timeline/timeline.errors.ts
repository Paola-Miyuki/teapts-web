import { HttpStatus } from '@nestjs/common';

import { PtsApiError } from '../pts/pts.errors';

export { ptsNotFound } from '../pts/pts.errors';

export const timelineForbidden = () =>
  new PtsApiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem acesso à timeline deste PTS.',
  );

export const invalidTimelinePeriod = () =>
  new PtsApiError(HttpStatus.BAD_REQUEST, 'ERROR', 'Parâmetro inválido: from');
