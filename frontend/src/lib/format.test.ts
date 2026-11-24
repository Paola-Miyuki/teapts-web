import { formatDate } from './format';

describe('formatDate', () => {
  it('usa o dia do horário de Brasília', () => {
    expect(formatDate('2026-12-02T01:30:00.000Z')).toBe('01/12/2026');
    expect(formatDate('2026-12-02T03:00:00.000Z')).toBe('02/12/2026');
  });
});
