import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePtsSheetRequestDto } from '../dto/update-pts-sheet.dto';

const valid = {
  caseStudyDate: '2026-10-01',
  diagnosisSummary: 'Diagnóstico em comum.',
  socialSituation: 'Mora com a mãe.',
  nextReviewAt: '2027-10-01',
};

const errorsOf = (payload: object) =>
  validate(plainToInstance(UpdatePtsSheetRequestDto, payload));

describe('UpdatePtsSheetRequestDto', () => {
  it('aceita só os campos obrigatórios', async () => {
    await expect(errorsOf(valid)).resolves.toHaveLength(0);
  });

  it('aceita a ficha completa, com opcionais nulos', async () => {
    await expect(
      errorsOf({
        ...valid,
        cid: 'F84.0',
        supportLevel: 3,
        strengths: null,
        priorityNeeds: ['Comunicação'],
        vulnerabilities: null,
        comorbidities: 'TDAH',
        sensoryProfile: 'Sensível a ruídos',
        communicationMethod: null,
      }),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['síntese ausente', { ...valid, diagnosisSummary: undefined }],
    ['síntese vazia', { ...valid, diagnosisSummary: '' }],
    ['síntese só com espaços', { ...valid, diagnosisSummary: '   ' }],
    ['situação social vazia', { ...valid, socialSituation: '' }],
    ['supportLevel 0', { ...valid, supportLevel: 0 }],
    ['supportLevel 4', { ...valid, supportLevel: 4 }],
    ['supportLevel decimal', { ...valid, supportLevel: 1.5 }],
    ['supportLevel texto', { ...valid, supportLevel: '2' }],
    ['caseStudyDate ausente', { ...valid, caseStudyDate: undefined }],
    ['caseStudyDate inexistente', { ...valid, caseStudyDate: '2026-02-31' }],
    [
      'caseStudyDate com horário',
      { ...valid, caseStudyDate: '2026-10-01T10:00:00Z' },
    ],
    ['nextReviewAt ausente', { ...valid, nextReviewAt: undefined }],
    ['nextReviewAt fora do formato', { ...valid, nextReviewAt: '01/10/2027' }],
    ['priorityNeeds não lista', { ...valid, priorityNeeds: 'Comunicação' }],
    ['priorityNeeds com não texto', { ...valid, priorityNeeds: [1] }],
    ['cid não textual', { ...valid, cid: 10 }],
  ])('rejeita %s', async (_name, payload) => {
    expect((await errorsOf(payload)).length).toBeGreaterThan(0);
  });
});
