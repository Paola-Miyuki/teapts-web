import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePtsRequestDto } from '../dto/create-pts.dto';

const valid = {
  professionalId: '550e8400-e29b-41d4-a716-446655440000',
  patientId: '650e8400-e29b-41d4-a716-446655440000',
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: ['750e8400-e29b-41d4-a716-446655440000'],
};

describe('CreatePtsRequestDto', () => {
  it('aceita um payload válido com UUIDs', async () => {
    const dto = plainToInstance(CreatePtsRequestDto, valid);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('aceita a equipe omitida', async () => {
    const payload = {
      professionalId: valid.professionalId,
      patientId: valid.patientId,
      socialSituation: valid.socialSituation,
    };
    const dto = plainToInstance(CreatePtsRequestDto, payload);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['professionalId inválido', { ...valid, professionalId: '10' }],
    ['patientId inválido', { ...valid, patientId: '25' }],
    ['situação social vazia', { ...valid, socialSituation: '' }],
    ['situação social não textual', { ...valid, socialSituation: 123 }],
    [
      'equipe não é um array',
      { ...valid, teamProfessionalIds: '750e8400-e29b-41d4-a716-446655440000' },
    ],
    [
      'equipe contém UUID inválido',
      { ...valid, teamProfessionalIds: ['inválido'] },
    ],
  ])('rejeita %s', async (_name, payload) => {
    const dto = plainToInstance(CreatePtsRequestDto, payload);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
