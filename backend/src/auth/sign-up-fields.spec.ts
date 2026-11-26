import { describe, expect, it } from '@jest/globals';
import {
  isValidBirthDate,
  isValidCpf,
  readSignUpFields,
  validateBirthDate,
  validateCpf,
  validateGender,
  validateName,
  validatePhone,
  validateSex,
} from './sign-up-fields';

describe('sign-up fields', () => {
  it('validates the name', async () => {
    await expect(validateName('Maria')).resolves.toBeUndefined();
    await expect(validateName('   ')).resolves.toBe('Informe o nome');
    await expect(validateName(42)).resolves.toBe('Informe o nome');
  });

  it('checks the CPF check digits, with or without mask', async () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
    await expect(validateCpf('529.982.247-25')).resolves.toBeUndefined();
    await expect(validateCpf('529.982.247-24')).resolves.toBe('CPF inválido');
  });

  it('accepts only existing, non-future birth dates', async () => {
    const today = new Date(2026, 10, 23);

    expect(isValidBirthDate('2026-11-23', today)).toBe(true);
    expect(isValidBirthDate('2026-11-24', today)).toBe(false);
    expect(isValidBirthDate('2026-02-30', today)).toBe(false);
    expect(isValidBirthDate('23/11/2000', today)).toBe(false);
    await expect(validateBirthDate('abc')).resolves.toBe(
      'Data de nascimento inválida',
    );
  });

  it('validates sex, gender and phone', async () => {
    await expect(validateSex('female')).resolves.toBeUndefined();
    await expect(validateSex('F')).resolves.toBe('Sexo inválido');
    await expect(validateGender('non_binary')).resolves.toBeUndefined();
    await expect(validateGender('x')).resolves.toBe('Gênero inválido');
    await expect(validatePhone('(11) 98765-4321')).resolves.toBeUndefined();
    await expect(validatePhone('(11) 3456-7890')).resolves.toBeUndefined();
    await expect(validatePhone('98765-4321')).resolves.toBe(
      'Telefone inválido',
    );
  });

  it('reads the account fields, keeping only digits and nulls for empty optionals', () => {
    expect(
      readSignUpFields([
        { id: 'name', value: ' Maria ' },
        { id: 'socialName', value: ' ' },
        { id: 'birthDate', value: '1990-05-20' },
        { id: 'sex', value: 'female' },
        { id: 'cpf', value: '529.982.247-25' },
        { id: 'phone', value: '' },
      ]),
    ).toEqual({
      name: 'Maria',
      socialName: null,
      birthDate: '1990-05-20',
      sex: 'female',
      gender: null,
      cpf: '52998224725',
      phone: null,
    });
    expect(readSignUpFields([{ id: 'name', value: 'Maria' }])).toBeNull();
  });
});
