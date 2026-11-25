import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { expectApiError } from '../../pts/__tests__/test-utils';
import { activityBody } from '../__tests__/activity-fixtures';
import { CreateActivityRequestDto } from './create-activity.dto';

const parse = (body: unknown): Promise<unknown> =>
  createValidationPipe().transform(body, {
    type: 'body',
    metatype: CreateActivityRequestDto,
  });

describe('CreateActivityRequestDto', () => {
  it('aceita a atividade mínima e apara os textos', async () => {
    expect(
      await parse({ ...activityBody(), title: '  Integração  ' }),
    ).toMatchObject({ ...activityBody(), title: 'Integração' });
  });

  it.each(['title', 'description', 'type', 'specialism', 'modality'])(
    'recusa sem %s',
    async (field) => {
      const body: Record<string, unknown> = { ...activityBody() };
      delete body[field];

      await expectApiError(() => parse(body), 400, 'VALIDATION_ERROR');
    },
  );

  it.each([
    ['title', '  '],
    ['description', '  '],
    ['type', 'x'],
    ['specialism', 'x'],
    ['modality', 'x'],
    ['visitPlace', 'x'],
    ['executor', 'x'],
    ['executorProfessionalIds', ['x']],
    ['goalId', 'x'],
    ['documentIds', ['x']],
    ['authorProfessionalId', 'x'],
  ])('recusa %s = %p', async (field, value) => {
    await expectApiError(
      () => parse({ ...activityBody(), [field]: value }),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('exige o local na visita externa', async () => {
    const body = { ...activityBody(), modality: 'external_visit' };

    await expectApiError(() => parse(body), 400, 'VALIDATION_ERROR');
    expect(await parse({ ...body, visitPlace: 'school' })).toMatchObject({
      visitPlace: 'school',
    });
  });

  // A frequência inválida responde 422, no serviço.
  it.each([undefined, 'x', { quantity: 0 }])(
    'deixa passar a frequência %p para o serviço',
    async (frequency) => {
      expect(await parse({ ...activityBody(), frequency })).toMatchObject({
        title: activityBody().title,
        ...(frequency !== undefined && { frequency }),
      });
    },
  );
});
