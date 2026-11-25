import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { RegisterReassessmentRequestDto } from '../dto/register-reassessment.dto';
import { expectApiError } from './test-utils';

const parse = (body: unknown): Promise<unknown> =>
  createValidationPipe().transform(body, {
    type: 'body',
    metatype: RegisterReassessmentRequestDto,
  });
const goalId = '5d7a1b3c-9e2f-4a6b-8c0d-1e2f3a4b5c6d';
const body = {
  meetingDate: '2026-12-15',
  goals: [{ goalId, status: 'partially_achieved' }],
  createNextVersion: true,
};

describe('RegisterReassessmentRequestDto (RFEVA005)', () => {
  it('aceita com e sem observação e motivo', async () => {
    expect(await parse(body)).toMatchObject(body);
    expect(
      await parse({
        ...body,
        goals: [{ goalId, status: 'achieved', note: 'Nota' }],
        reason: 'Motivo',
      }),
    ).toMatchObject({ reason: 'Motivo', goals: [{ note: 'Nota' }] });
  });

  it.each([
    { ...body, meetingDate: '2026-02-30' },
    { ...body, meetingDate: '15/12/2026' },
    { ...body, goals: 'x' },
    { ...body, goals: [{ goalId: 'x', status: 'achieved' }] },
    { ...body, goals: [{ goalId, status: 'in_progress' }] },
    { ...body, goals: [{ goalId, status: 'achieved', note: 3 }] },
    { ...body, createNextVersion: 'sim' },
    { meetingDate: '2026-12-15', goals: [] },
    { ...body, reason: 3 },
  ])('recusa %j', async (value) => {
    await expectApiError(() => parse(value), 400, 'VALIDATION_ERROR');
  });
});
