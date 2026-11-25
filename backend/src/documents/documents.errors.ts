// Erros de negócio dos documentos, no formato `{ status, message }` da API.

import { BadRequestException, ForbiddenException } from '@nestjs/common';

export const uploadNotFound = () =>
  new BadRequestException({
    status: 'UPLOAD_NOT_FOUND',
    message: 'O arquivo não foi encontrado no storage. Envie-o novamente.',
  });

export const invalidIssuerAccount = () =>
  new BadRequestException({
    status: 'VALIDATION_ERROR',
    message: 'O emissor informado não é um profissional cadastrado.',
  });

export const documentForbidden = () =>
  new ForbiddenException({
    status: 'FORBIDDEN',
    message: 'Você não tem acesso aos documentos deste paciente.',
  });
