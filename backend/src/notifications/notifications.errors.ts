import { HttpStatus } from '@nestjs/common';

import { PtsApiError } from '../pts/pts.errors';

export const notificationNotFound = () =>
  new PtsApiError(
    HttpStatus.NOT_FOUND,
    'NOTIFICATION_NOT_FOUND',
    'Notificação não encontrada.',
  );
