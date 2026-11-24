// Este arquivo testa a validação do corpo do cadastro de perfil profissional,
// pelo mesmo ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { Specialism } from '../enums/specialism.enum';
import { CreateProfessionalRequestDto } from './create-professional-request.dto';

const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: CreateProfessionalRequestDto,
  }) as Promise<CreateProfessionalRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

const registration = { councilNumber: '6789', councilState: 'pr' };
const valid = {
  accountId,
  specialism: Specialism.SpeechTherapist,
  ...registration,
};

describe('CreateProfessionalRequestDto', () => {
  it.each(Object.values(Specialism))(
    'accepts the account with the %s specialism',
    async (specialism) => {
      await expect(
        normalize({ accountId, specialism, ...registration }),
      ).resolves.toEqual({ accountId, specialism, ...registration });
    },
  );

  it('accepts the optional institution and CNES', async () => {
    const body = { ...valid, institution: 'CAPSi Boa Vista', cnes: '1234567' };

    await expect(normalize(body)).resolves.toEqual(body);
  });

  it('drops fields the DTO does not declare', async () => {
    await expect(normalize({ ...valid, name: 'Kaio' })).resolves.toEqual(valid);
  });

  it.each([
    [
      'a missing accountId',
      { ...valid, accountId: undefined },
      'Informe uma conta válida.',
    ],
    [
      'an accountId that is not a UUID',
      { ...valid, accountId: '123' },
      'Informe uma conta válida.',
    ],
    [
      'a missing specialism',
      { ...valid, specialism: undefined },
      'Informe uma especialidade válida.',
    ],
    [
      'a specialism outside the list',
      { ...valid, specialism: 'astronaut' },
      'Informe uma especialidade válida.',
    ],
    [
      'a missing council number',
      { ...valid, councilNumber: undefined },
      'Informe o número do registro.',
    ],
    [
      'an empty council number',
      { ...valid, councilNumber: '' },
      'Informe o número do registro.',
    ],
    [
      'a blank council number',
      { ...valid, councilNumber: '   ' },
      'Informe o número do registro.',
    ],
    [
      'a non-text council number',
      { ...valid, councilNumber: 6789 },
      'Informe o número do registro.',
    ],
    [
      'a missing council state',
      { ...valid, councilState: undefined },
      'Informe uma UF válida.',
    ],
    [
      'an unknown council state',
      { ...valid, councilState: 'xx' },
      'Informe uma UF válida.',
    ],
    [
      'an uppercase council state',
      { ...valid, councilState: 'PR' },
      'Informe uma UF válida.',
    ],
    [
      'a non-text institution',
      { ...valid, institution: 10 },
      'Informe uma instituição válida.',
    ],
    [
      'a CNES with 6 digits',
      { ...valid, cnes: '123456' },
      'O CNES deve ter 7 dígitos.',
    ],
    [
      'a CNES with 8 digits',
      { ...valid, cnes: '12345678' },
      'O CNES deve ter 7 dígitos.',
    ],
    [
      'a CNES with letters',
      { ...valid, cnes: '12345ab' },
      'O CNES deve ter 7 dígitos.',
    ],
    ['an empty CNES', { ...valid, cnes: '' }, 'O CNES deve ter 7 dígitos.'],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body, message) => {
    await expect(errorBody(body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
