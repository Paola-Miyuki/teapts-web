import { isValidPhone } from './patients';

describe('isValidPhone', () => {
  it.each([
    '(11) 98765-4321',
    '(11) 3456-7890',
    '11987654321',
    '+55 11 98765-4321',
    '5511987654321',
  ])('aceita %s', (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  it.each([
    '98765',
    '987654321',
    '(11) 98765-43210',
    '11 9876a-4321',
    '+1 (11) 98765-4321',
  ])('recusa %s', (phone) => {
    expect(isValidPhone(phone)).toBe(false);
  });
});
