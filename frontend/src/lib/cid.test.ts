import { cidDescription } from './cid';

describe('cidDescription', () => {
  it('describes the known codes, ignoring case and spaces', () => {
    expect(cidDescription('F84.0')).toBe('Autismo infantil');
    expect(cidDescription(' f84.5 ')).toBe('Síndrome de Asperger');
  });

  it('returns null for a code outside the table', () => {
    expect(cidDescription('Z99.9')).toBeNull();
  });
});
