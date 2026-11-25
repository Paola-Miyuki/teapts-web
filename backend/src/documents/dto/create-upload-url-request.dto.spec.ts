// Este arquivo testa a validação do pedido da URL de envio, pelo mesmo
// ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../../storage/file-policy';
import { CreateUploadUrlRequestDto } from './create-upload-url-request.dto';

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: CreateUploadUrlRequestDto,
  }) as Promise<CreateUploadUrlRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

const valid = {
  fileName: 'laudo.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 820000,
};

describe('CreateUploadUrlRequestDto', () => {
  it.each(ALLOWED_MIME_TYPES)('accepts the %s type', async (mimeType) => {
    await expect(normalize({ ...valid, mimeType })).resolves.toEqual({
      ...valid,
      mimeType,
    });
  });

  it('accepts a file of exactly 5 MB', async () => {
    await expect(
      normalize({ ...valid, sizeBytes: MAX_FILE_SIZE_BYTES }),
    ).resolves.toEqual({ ...valid, sizeBytes: MAX_FILE_SIZE_BYTES });
  });

  it('drops fields the DTO does not declare', async () => {
    await expect(normalize({ ...valid, patientId: 'x' })).resolves.toEqual(
      valid,
    );
  });

  it.each(['text/html', 'image/gif', undefined])(
    'rejects the type %s with FILE_TYPE_NOT_ALLOWED',
    async (mimeType) => {
      await expect(errorBody({ ...valid, mimeType })).resolves.toEqual({
        status: 'FILE_TYPE_NOT_ALLOWED',
        message:
          'Tipo de arquivo não permitido. Envie PDF, PNG, JPG, DOC ou DOCX.',
      });
    },
  );

  it('rejects a file above 5 MB with FILE_TOO_LARGE', async () => {
    await expect(
      errorBody({ ...valid, sizeBytes: MAX_FILE_SIZE_BYTES + 1 }),
    ).resolves.toEqual({
      status: 'FILE_TOO_LARGE',
      message: 'O arquivo deve ter no máximo 5 MB.',
    });
  });

  it.each([
    [
      'a missing file name',
      { fileName: undefined },
      'Informe o nome do arquivo.',
    ],
    ['an empty file name', { fileName: '' }, 'Informe o nome do arquivo.'],
    ['a zero size', { sizeBytes: 0 }, 'Informe o tamanho do arquivo.'],
    ['a fractional size', { sizeBytes: 1.5 }, 'Informe o tamanho do arquivo.'],
    [
      'a missing size',
      { sizeBytes: undefined },
      'Informe o tamanho do arquivo.',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_name, change, message) => {
    await expect(errorBody({ ...valid, ...change })).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
