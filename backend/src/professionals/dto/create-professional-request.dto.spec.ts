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

describe('CreateProfessionalRequestDto', () => {
  it.each(Object.values(Specialism))(
    'accepts the account with the %s specialism',
    async (specialism) => {
      await expect(normalize({ accountId, specialism })).resolves.toEqual({
        accountId,
        specialism,
      });
    },
  );

  it('drops fields the DTO does not declare', async () => {
    await expect(
      normalize({ accountId, specialism: Specialism.Doctor, name: 'Kaio' }),
    ).resolves.toEqual({ accountId, specialism: Specialism.Doctor });
  });

  it.each([
    [
      'a missing accountId',
      { specialism: Specialism.Doctor },
      'Informe uma conta válida.',
    ],
    [
      'an accountId that is not a UUID',
      { accountId: '123', specialism: Specialism.Doctor },
      'Informe uma conta válida.',
    ],
    [
      'a missing specialism',
      { accountId },
      'Informe uma especialidade válida.',
    ],
    [
      'a specialism outside the enum',
      { accountId, specialism: 'nurse' },
      'Informe uma especialidade válida.',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body, message) => {
    await expect(errorBody(body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
