import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ChangePasswordRequestDto } from './change-password-request.dto';
import { UpdateMeRequestDto } from './update-me-request.dto';

async function validate(
  metatype: new () => object,
  value: unknown,
): Promise<object> {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype,
  });
}

async function getErrorBody(metatype: new () => object, value: unknown) {
  try {
    await validate(metatype, value);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }

  throw new Error('Expected a validation error');
}

describe('UpdateMeRequestDto', () => {
  it('rejects an empty or whitespace-only name', async () => {
    await expect(
      getErrorBody(UpdateMeRequestDto, { name: '   ' }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe um nome válido.',
    });
  });

  it('rejects an invalid email', async () => {
    await expect(
      getErrorBody(UpdateMeRequestDto, { email: 'invalid' }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido.',
    });
  });

  it('rejects a null name', async () => {
    await expect(
      getErrorBody(UpdateMeRequestDto, { name: null }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe um nome válido.',
    });
  });

  it('rejects a null email', async () => {
    await expect(
      getErrorBody(UpdateMeRequestDto, { email: null }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido.',
    });
  });

  it('requires at least one field', async () => {
    await expect(getErrorBody(UpdateMeRequestDto, {})).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe ao menos um dado da conta.',
    });
  });

  it('normalizes the personal data and turns empty optionals into null', async () => {
    await expect(
      validate(UpdateMeRequestDto, {
        socialName: '  ',
        birthDate: '1990-05-20',
        sex: 'female',
        gender: null,
        phone: '(11) 98765-4321',
      }),
    ).resolves.toEqual({
      socialName: null,
      birthDate: '1990-05-20',
      sex: 'female',
      gender: null,
      phone: '11987654321',
    });
  });

  it.each([
    [{ birthDate: '2999-01-01' }, 'Informe uma data de nascimento válida.'],
    [{ sex: 'other' }, 'Informe um sexo válido.'],
    [{ gender: 'x' }, 'Informe um gênero válido.'],
    [{ phone: '1234' }, 'Informe um telefone válido, com DDD.'],
  ])('rejects invalid personal data %j', async (body, message) => {
    await expect(getErrorBody(UpdateMeRequestDto, body)).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message,
    });
  });

  it('accepts optional fields and normalizes them', async () => {
    await expect(
      validate(UpdateMeRequestDto, {
        name: '  Maria Silva  ',
        email: ' MARIA@EXAMPLE.COM ',
      }),
    ).resolves.toEqual({
      name: 'Maria Silva',
      email: 'maria@example.com',
    });
  });
});

describe('ChangePasswordRequestDto', () => {
  it('requires current and new passwords', async () => {
    await expect(getErrorBody(ChangePasswordRequestDto, {})).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe a senha atual.',
    });
  });

  it('rejects a null current password', async () => {
    await expect(
      getErrorBody(ChangePasswordRequestDto, {
        currentPassword: null,
        newPassword: 'NewPassword123',
      }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe a senha atual.',
    });
  });

  it('rejects a null new password', async () => {
    await expect(
      getErrorBody(ChangePasswordRequestDto, {
        currentPassword: 'Current123',
        newPassword: null,
      }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe a nova senha.',
    });
  });
});
