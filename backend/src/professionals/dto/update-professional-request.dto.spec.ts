// Este arquivo testa a validação do corpo da troca de especialidade, pelo
// mesmo ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { Specialism } from '../enums/specialism.enum';
import { UpdateProfessionalRequestDto } from './update-professional-request.dto';

function normalize(body: unknown) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: UpdateProfessionalRequestDto,
  }) as Promise<UpdateProfessionalRequestDto>;
}

async function errorBody(body: unknown) {
  const error: unknown = await normalize(body).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('UpdateProfessionalRequestDto', () => {
  it.each(Object.values(Specialism))(
    'accepts only the %s specialism',
    async (specialism) => {
      await expect(normalize({ specialism })).resolves.toEqual({ specialism });
    },
  );

  it('accepts the new council registration', async () => {
    const body = {
      specialism: Specialism.Nurse,
      councilNumber: '6789',
      councilState: 'pr',
    };

    await expect(normalize(body)).resolves.toEqual(body);
  });

  it('drops fields the DTO does not declare', async () => {
    await expect(
      normalize({ specialism: Specialism.Nurse, name: 'Kaio' }),
    ).resolves.toEqual({ specialism: Specialism.Nurse });
  });

  it.each([
    ['a missing specialism', {}, 'Informe uma especialidade válida.'],
    [
      'a specialism outside the list',
      { specialism: 'astronaut' },
      'Informe uma especialidade válida.',
    ],
    [
      'a blank council number',
      { specialism: Specialism.Nurse, councilNumber: '  ' },
      'Informe o número do registro.',
    ],
    [
      'a council state outside the list',
      { specialism: Specialism.Nurse, councilState: 'xx' },
      'Informe uma UF válida.',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_name, body, message) => {
    await expect(errorBody(body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });
});
