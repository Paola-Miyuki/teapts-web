import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { CreateGoalRequestDto } from '../dto/create-goal.dto';
import { UpdateGoalRequestDto } from '../dto/update-goal.dto';
import { goalBody } from './goal-fixtures';
import { expectApiError } from './test-utils';

const pipe = createValidationPipe();
const parse = (
  metatype: typeof CreateGoalRequestDto | typeof UpdateGoalRequestDto,
  body: unknown,
) => pipe.transform(body, { type: 'body', metatype });

describe('CreateGoalRequestDto', () => {
  it('aceita a meta completa e apara os textos', async () => {
    const dto: unknown = await parse(CreateGoalRequestDto, {
      ...goalBody(),
      title: '  Meta  ',
    });

    expect(dto).toMatchObject({ ...goalBody(), title: 'Meta' });
  });

  it.each([
    'title',
    'description',
    'term',
    'area',
    'measureCriterion',
    'targetDate',
  ])('recusa a meta sem %s', async (field) => {
    const body: Record<string, unknown> = { ...goalBody() };
    delete body[field];

    await expectApiError(
      () => parse(CreateGoalRequestDto, body),
      400,
      'VALIDATION_ERROR',
    );
  });

  it.each([
    ['title', '   '],
    ['description', '   '],
    ['measureCriterion', '   '],
    ['measureCriterion', 3],
    ['term', 'forever'],
    ['area', 'other'],
    ['targetDate', '2027-02-30'],
    ['targetDate', '2027-02-28T10:00:00Z'],
    ['authorProfessionalId', 'x'],
  ])('recusa %s = %p', async (field, value) => {
    await expectApiError(
      () => parse(CreateGoalRequestDto, { ...goalBody(), [field]: value }),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('UpdateGoalRequestDto', () => {
  it('aceita só os campos enviados e descarta a autoria', async () => {
    const dto: unknown = await parse(UpdateGoalRequestDto, {
      title: 'Outro título',
      authorProfessionalId: '11111111-1111-4111-8111-111111111111',
    });

    expect({ ...(dto as object) }).toEqual({ title: 'Outro título' });
  });

  it.each([
    ['measureCriterion', ''],
    ['title', null],
    ['term', null],
    ['targetDate', null],
  ])('recusa %s = %p', async (field, value) => {
    await expectApiError(
      () => parse(UpdateGoalRequestDto, { [field]: value }),
      400,
      'VALIDATION_ERROR',
    );
  });
});
