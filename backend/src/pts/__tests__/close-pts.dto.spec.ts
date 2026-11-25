import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ClosePtsRequestDto } from '../dto/close-pts.dto';
import { expectApiError } from './test-utils';

const parse = (body: unknown): Promise<unknown> =>
  createValidationPipe().transform(body, {
    type: 'body',
    metatype: ClosePtsRequestDto,
  });
const body = { outcome: 'concluded', closingDate: '2026-12-10' };

describe('ClosePtsRequestDto', () => {
  it('aceita com e sem motivo', async () => {
    expect(await parse(body)).toMatchObject(body);
    expect(await parse({ ...body, reason: 'Motivo' })).toMatchObject({
      reason: 'Motivo',
    });
  });

  it.each([
    { closingDate: '2026-12-10' },
    { ...body, outcome: 'rejected' },
    { outcome: 'concluded' },
    { ...body, closingDate: '2026-02-30' },
    { ...body, closingDate: '2026-12-10T10:00:00Z' },
    { ...body, reason: 3 },
  ])('recusa %j', async (value) => {
    await expectApiError(() => parse(value), 400, 'VALIDATION_ERROR');
  });
});
