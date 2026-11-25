// Este arquivo testa a validação da confirmação do documento, pelo mesmo
// ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ConfirmDocumentRequestDto } from './confirm-document-request.dto';

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: ConfirmDocumentRequestDto,
  }) as Promise<ConfirmDocumentRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

const valid = {
  fileKey: 'patient-1/abc-laudo.pdf',
  title: 'Laudo neurológico',
  category: 'medical_report',
};
const accountId = '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

describe('ConfirmDocumentRequestDto', () => {
  it('accepts only the required fields', async () => {
    await expect(normalize(valid)).resolves.toEqual(valid);
  });

  it('accepts every optional field with an outside issuer', async () => {
    const body = {
      ...valid,
      issueDate: '2026-11-20',
      issuerName: 'Dra. Marta Reis, CRM-PR 12345',
      description: 'Laudo de 2026',
    };

    await expect(normalize(body)).resolves.toEqual(body);
  });

  it('accepts a professional issuer by account id', async () => {
    const body = { ...valid, issuerAccountId: accountId };

    await expect(normalize(body)).resolves.toEqual(body);
  });

  it('rejects both issuers at the same time', async () => {
    await expect(
      errorBody({ ...valid, issuerAccountId: accountId, issuerName: 'Fulana' }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe só um emissor.',
    });
  });

  it.each([
    [
      'a missing file key',
      { fileKey: undefined },
      'Informe o arquivo enviado.',
    ],
    ['an empty title', { title: '' }, 'Informe o título.'],
    ['a missing title', { title: undefined }, 'Informe o título.'],
    [
      'an unknown category',
      { category: 'foto' },
      'Escolha uma categoria válida.',
    ],
    [
      'a date out of the format',
      { issueDate: '20/11/2026' },
      'Informe a data de emissão no formato AAAA-MM-DD.',
    ],
    [
      'an issuer that is not a UUID',
      { issuerAccountId: '123' },
      'Emissor inválido.',
    ],
    ['an empty outside issuer', { issuerName: '' }, 'Informe o emissor.'],
  ])('rejects %s with VALIDATION_ERROR', async (_name, change, message) => {
    await expect(errorBody({ ...valid, ...change })).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
