// Este arquivo testa a validação e a normalização do corpo do cadastro de
// perfil de paciente, pelo mesmo ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { CreatePatientRequestDto } from './create-patient-request.dto';

const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: CreatePatientRequestDto,
  }) as Promise<CreatePatientRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('CreatePatientRequestDto', () => {
  it('accepts the account without support contacts', async () => {
    await expect(normalize({ accountId })).resolves.toEqual({ accountId });
  });

  it('accepts the payload of the issue', async () => {
    const contact = {
      name: 'Maria Martins',
      description: 'Mãe',
      email: 'maria@exemplo.com',
      phone: '(11) 98765-4321',
    };

    await expect(
      normalize({ accountId, supportContacts: [contact] }),
    ).resolves.toEqual({ accountId, supportContacts: [contact] });
  });

  it('trims the contact and drops empty optional fields', async () => {
    const result = await normalize({
      accountId,
      supportContacts: [
        { name: '  Maria  ', description: ' ', email: '', phone: ' 1234 ' },
      ],
    });

    expect(result.supportContacts).toEqual([
      expect.objectContaining({ name: 'Maria', phone: '1234' }),
    ]);
    expect(result.supportContacts?.[0].email).toBeUndefined();
    expect(result.supportContacts?.[0].description).toBeUndefined();
  });

  it.each([
    ['a missing accountId', {}, 'Informe uma conta válida.'],
    [
      'an accountId that is not a UUID',
      { accountId: '123' },
      'Informe uma conta válida.',
    ],
    [
      'supportContacts that is not a list',
      { accountId, supportContacts: 'Maria' },
      'Informe contatos de suporte válidos.',
    ],
    [
      'a contact that is not an object',
      { accountId, supportContacts: ['Maria'] },
      'Informe contatos de suporte válidos.',
    ],
    [
      'a contact without name',
      { accountId, supportContacts: [{ email: 'maria@exemplo.com' }] },
      'Informe o nome do contato.',
    ],
    [
      'a contact whose name is only spaces',
      { accountId, supportContacts: [{ name: '   ' }] },
      'Informe o nome do contato.',
    ],
    [
      'an invalid contact email',
      { accountId, supportContacts: [{ name: 'Maria', email: 'maria' }] },
      'Informe um e-mail válido para o contato.',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body, message) => {
    await expect(errorBody(body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
