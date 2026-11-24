// Este arquivo testa a validação do corpo do PATCH de um contato de suporte,
// pelo mesmo ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { UpdateSupportContactRequestDto } from './update-support-contact-request.dto';

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: UpdateSupportContactRequestDto,
  }) as Promise<UpdateSupportContactRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('UpdateSupportContactRequestDto', () => {
  it('accepts a body with a single field', async () => {
    await expect(normalize({ isEmergency: true })).resolves.toEqual({
      isEmergency: true,
    });
  });

  it('accepts null to clear the optional fields', async () => {
    const result = await normalize({
      description: null,
      email: null,
      phone: null,
    });

    expect(result).toEqual({ description: null, email: null, phone: null });
  });

  it('trims the text and drops the empty optional fields', async () => {
    const result = await normalize({
      name: '  Joana  ',
      description: ' ',
      phone: ' (11) 98765-4321 ',
    });

    expect(result.name).toBe('Joana');
    expect(result.description).toBeUndefined();
    expect(result.phone).toBe('(11) 98765-4321');
  });

  it.each(['+55 (11) 98765-4321', '5511987654321', '(11) 3456-7890'])(
    'accepts the phone %s with DDD',
    async (phone) => {
      await expect(normalize({ phone })).resolves.toEqual({ phone });
    },
  );

  it('does not require e-mail or phone, which the service checks on the result', async () => {
    await expect(normalize({ name: 'Joana' })).resolves.toEqual({
      name: 'Joana',
    });
  });

  it('drops fields that the contact does not declare', async () => {
    const result = await normalize({ name: 'Joana', canAccessRecords: true });

    expect(result).not.toHaveProperty('canAccessRecords');
  });

  it.each([
    [
      'a name that is only spaces',
      { name: '   ' },
      'Informe o nome do contato.',
    ],
    ['a null name', { name: null }, 'Informe o nome do contato.'],
    [
      'an invalid e-mail',
      { email: 'joana' },
      'Informe um e-mail válido para o contato.',
    ],
    [
      'a phone without DDD',
      { phone: '98765-4321' },
      'Informe um telefone válido para o contato.',
    ],
    [
      'a phone with letters',
      { phone: '(11) 98765-43ab21' },
      'Informe um telefone válido para o contato.',
    ],
    [
      'an isEmergency that is not a boolean',
      { isEmergency: 'sim' },
      'Informe se o contato é de emergência.',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body, message) => {
    await expect(errorBody(body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
