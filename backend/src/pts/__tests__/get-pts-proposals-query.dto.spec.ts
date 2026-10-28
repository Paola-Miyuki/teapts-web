import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DEFAULT_PTS_PROPOSALS_LIMIT,
  DEFAULT_PTS_PROPOSALS_PAGE,
  GetPtsProposalsQueryDto,
} from '../dto/get-pts-proposals-query.dto';

const patientId = '123e4567-e89b-12d3-a456-426614174000';

async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(GetPtsProposalsQueryDto, query);
  const errors = await validate(dto);

  return { dto, errors };
}

describe('GetPtsProposalsQueryDto', () => {
  it('usa os valores padrão de página e limite', async () => {
    const { dto, errors } = await validateQuery({ patientId });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(DEFAULT_PTS_PROPOSALS_PAGE);
    expect(dto.limit).toBe(DEFAULT_PTS_PROPOSALS_LIMIT);
  });

  it('converte página e limite recebidos como strings', async () => {
    const { dto, errors } = await validateQuery({
      patientId,
      page: '2',
      limit: '30',
    });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(30);
  });

  it('rejeita um patientId que não seja UUID', async () => {
    const { errors } = await validateQuery({
      patientId: 'id-invalido',
    });

    expect(errors.some((error) => error.property === 'patientId')).toBe(true);
    expect(
      errors.find((error) => error.property === 'patientId')?.contexts?.isUuid
        ?.status,
    ).toBe('VALIDATION_ERROR');
  });

  it('rejeita uma página menor que 1', async () => {
    const { errors } = await validateQuery({
      patientId,
      page: '0',
    });

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('rejeita uma página que não seja um número inteiro', async () => {
    const { errors } = await validateQuery({
      patientId,
      page: 'abc',
    });

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('rejeita um limite menor que 1', async () => {
    const { errors } = await validateQuery({
      patientId,
      limit: '0',
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejeita um limite maior que 50', async () => {
    const { errors } = await validateQuery({
      patientId,
      limit: '51',
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('aceita o limite máximo de 50', async () => {
    const { dto, errors } = await validateQuery({
      patientId,
      limit: '50',
    });

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
  });
});
