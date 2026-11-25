import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { expectApiError } from '../../pts/__tests__/test-utils';
import { GetNotificationsQueryDto } from './get-notifications-query.dto';

const parse = (query: unknown): Promise<unknown> =>
  createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetNotificationsQueryDto,
  });

describe('GetNotificationsQueryDto', () => {
  it.each([
    [{}, undefined],
    [{ unread: '' }, undefined],
    [{ unread: 'true' }, true],
    [{ unread: 'false' }, false],
  ])('%j → unread %p', async (query, unread) => {
    expect(await parse(query)).toMatchObject({ page: 1, limit: 20 });
    expect(((await parse(query)) as GetNotificationsQueryDto).unread).toBe(
      unread,
    );
  });

  it.each([{ unread: 'talvez' }, { page: '0' }, { limit: '51' }])(
    'recusa %j',
    async (query) => {
      await expectApiError(() => parse(query), 400, 'ERROR');
    },
  );
});
