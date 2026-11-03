import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetActivePtsQueryDto } from '../dto/get-active-pts-query.dto';

describe('GetActivePtsQueryDto', () => {
  it('rejeita UUID inválido com a mensagem do parâmetro', async () => {
    const dto = plainToInstance(GetActivePtsQueryDto, {
      patientId: 'id-invalido',
    });

    const errors = await validate(dto);

    expect(errors[0]?.constraints?.isUuid).toBe(
      'Parâmetro inválido: patientId',
    );
  });
});
