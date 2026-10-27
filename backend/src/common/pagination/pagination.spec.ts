// Este arquivo testa a montagem do bloco `pagination` das respostas.

import { toPagination } from './pagination';

describe('toPagination', () => {
  it('returns the page, the limit, the total and the number of pages', () => {
    expect(toPagination({ page: 2, limit: 20 }, 41)).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('returns zero pages when nothing was found', () => {
    expect(toPagination({ page: 1, limit: 20 }, 0)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
