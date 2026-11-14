// Este arquivo testa a validação e a normalização do corpo da atualização de
// contatos de suporte, pelo mesmo ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { UpdateSupportContactsRequestDto } from './update-support-contacts-request.dto';

const contact = {
  name: 'Joana Silva',
  description: 'Mãe',
  email: 'joana@example.com',
  phone: '(11) 98765-4321',
};

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: UpdateSupportContactsRequestDto,
  }) as Promise<UpdateSupportContactsRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('UpdateSupportContactsRequestDto', () => {
  it('accepts the payload of the issue', async () => {
    await expect(normalize({ supportContacts: [contact] })).resolves.toEqual({
      supportContacts: [contact],
    });
  });

  it('accepts an empty list, which removes every contact', async () => {
    await expect(normalize({ supportContacts: [] })).resolves.toEqual({
      supportContacts: [],
    });
  });

  it('trims the contact and drops empty optional fields', async () => {
    const result = await normalize({
      supportContacts: [
        { name: '  Joana  ', description: ' ', email: '', phone: '   ' },
      ],
    });

    expect(result.supportContacts).toEqual([
      expect.objectContaining({ name: 'Joana' }),
    ]);
    expect(result.supportContacts[0].description).toBeUndefined();
    expect(result.supportContacts[0].email).toBeUndefined();
    expect(result.supportContacts[0].phone).toBeUndefined();
  });

  it('drops fields that the contact does not declare', async () => {
    const result = await normalize({
      supportContacts: [{ name: 'Joana', canAccessRecords: true }],
    });

    expect(result.supportContacts[0]).not.toHaveProperty('canAccessRecords');
  });

  it.each([
    ['a missing supportContacts', {}, 'Informe contatos de suporte válidos.'],
    [
      'supportContacts that is not a list',
      { supportContacts: 'Joana' },
      'Informe contatos de suporte válidos.',
    ],
    [
      'a contact that is not an object',
      { supportContacts: ['Joana'] },
      'Informe contatos de suporte válidos.',
    ],
    [
      'a contact without name',
      { supportContacts: [{ email: 'joana@example.com' }] },
      'Informe o nome do contato.',
    ],
    [
      'an invalid contact email',
      { supportContacts: [{ name: 'Joana', email: 'joana' }] },
      'Informe um e-mail válido para o contato.',
    ],
    [
      'a contact phone that is not text',
      { supportContacts: [{ name: 'Joana', phone: 11987654321 }] },
      'Informe um telefone válido para o contato.',
    ],
    [
      'one invalid contact among valid ones',
      { supportContacts: [contact, { name: 'Pedro', email: 'pedro' }] },
      'Informe um e-mail válido para o contato.',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body, message) => {
    await expect(errorBody(body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
