import { parseCreatePtsRequest } from '../dto/create-pts.dto';
import { expectApiError } from './test-utils';

const valid = {
  professionalId: 10,
  patientId: 25,
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: [11, 15],
};

describe('parseCreatePtsRequest', () => {
  it('aceita o payload do contrato', () => {
    expect(parseCreatePtsRequest(valid)).toEqual(valid);
  });

  it('normaliza: trim na situação social e equipe padrão []', () => {
    const { teamProfessionalIds: _omit, ...rest } = valid;
    expect(parseCreatePtsRequest({ ...rest, socialSituation: '  texto  ' })).toMatchObject({
      socialSituation: 'texto',
      teamProfessionalIds: [],
    });
  });

  it.each([
    ['body ausente', undefined, ['professionalId', 'patientId', 'socialSituation']],
    ['body não-objeto', 'abc', ['professionalId', 'patientId', 'socialSituation']],
    ['professionalId ausente', { ...valid, professionalId: undefined }, ['professionalId']],
    ['patientId como string', { ...valid, patientId: '25' }, ['patientId']],
    ['patientId decimal', { ...valid, patientId: 2.5 }, ['patientId']],
    ['patientId negativo', { ...valid, patientId: -1 }, ['patientId']],
    ['situação social vazia', { ...valid, socialSituation: '' }, ['socialSituation']],
    ['situação social só com espaços', { ...valid, socialSituation: '   ' }, ['socialSituation']],
    ['situação social não-string', { ...valid, socialSituation: 123 }, ['socialSituation']],
    ['equipe não-array', { ...valid, teamProfessionalIds: '11' }, ['teamProfessionalIds']],
    ['equipe com item inválido', { ...valid, teamProfessionalIds: [11, 'x'] }, ['teamProfessionalIds']],
  ])('rejeita %s com 400 VALIDATION_ERROR', async (_name, input, fields) => {
    const res = await expectApiError(() => parseCreatePtsRequest(input), 400, 'VALIDATION_ERROR');
    expect((res.errors as { field: string }[]).map((e) => e.field)).toEqual(fields);
  });
});
