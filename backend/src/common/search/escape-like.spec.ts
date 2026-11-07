// Este arquivo testa o escape dos curingas do ILIKE.

import { escapeLike } from './escape-like';

describe('escapeLike', () => {
  it('keeps plain text unchanged', () => {
    expect(escapeLike('Maria Silva')).toBe('Maria Silva');
  });

  it.each([
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['a\\b', 'a\\\\b'],
  ])('escapes the wildcards of %s', (term, expected) => {
    expect(escapeLike(term)).toBe(expected);
  });
});
