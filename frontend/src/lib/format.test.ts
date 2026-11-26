import { addMonths, formatAge, formatCep, formatDate } from './format';

describe('formatDate', () => {
  it('usa o dia do horário de Brasília', () => {
    expect(formatDate('2026-12-02T01:30:00.000Z')).toBe('01/12/2026');
    expect(formatDate('2026-12-02T03:00:00.000Z')).toBe('02/12/2026');
  });
});

describe('formatCep', () => {
  it('masks 8 digits and keeps anything else', () => {
    expect(formatCep('80045140')).toBe('80045-140');
    expect(formatCep('80045-140')).toBe('80045-140');
    expect(formatCep('123')).toBe('123');
  });
});

describe('formatAge', () => {
  it.each([
    ['2019-04-18', '2026-11-21', '7 anos, 7 meses e 3 dias'],
    ['2019-04-18', '2026-04-18', '7 anos'],
    ['2019-04-18', '2026-05-18', '7 anos e 1 mês'],
    ['2019-04-18', '2026-04-19', '7 anos e 1 dia'],
    ['2026-01-10', '2026-03-12', '2 meses e 2 dias'],
    ['2026-03-01', '2026-03-12', '11 dias'],
    ['2000-12-31', '2026-01-01', '25 anos e 1 dia'],
    ['2024-02-29', '2025-02-28', '11 meses e 30 dias'],
    ['2026-03-12', '2026-03-12', '0 dias'],
  ])('%s on %s is "%s"', (birth, today, expected) => {
    const [year, month, day] = today.split('-').map(Number);

    expect(formatAge(birth, new Date(year, month - 1, day))).toBe(expected);
  });
});

describe('addMonths', () => {
  it.each([
    ['2026-12-15', 6, '2027-06-15'],
    ['2026-08-31', 6, '2027-02-28'],
    ['2026-01-10', 12, '2027-01-10'],
  ])('%s + %s meses = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
  });
});
