// Este arquivo testa o pipe global de validação: o formato do erro
// `{ status, message }` e a limpeza dos campos que o DTO não declara.

import { BadRequestException } from '@nestjs/common';
import { IsInt, IsString } from 'class-validator';
import {
  DEFAULT_VALIDATION_STATUS,
  createValidationPipe,
} from './create-validation-pipe';

class WithStatusDto {
  @IsString({ message: 'Nome inválido', context: { status: 'ERROR' } })
  name!: string;
}

class WithoutStatusDto {
  @IsInt({ message: 'Idade inválida' })
  age!: number;

  @IsString({ message: 'Nome inválido' })
  name!: string;
}

async function validate(metatype: new () => object, value: unknown) {
  return createValidationPipe().transform(value, { type: 'body', metatype });
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

describe('createValidationPipe', () => {
  it('uses the status declared in the constraint context', async () => {
    await expect(getErrorBody(WithStatusDto, { name: 1 })).resolves.toEqual({
      status: 'ERROR',
      message: 'Nome inválido',
    });
  });

  it('falls back to VALIDATION_ERROR when the constraint has no context', async () => {
    expect(DEFAULT_VALIDATION_STATUS).toBe('VALIDATION_ERROR');
    await expect(getErrorBody(WithoutStatusDto, {})).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Idade inválida',
    });
  });

  it('reports only the first invalid property', async () => {
    await expect(
      getErrorBody(WithoutStatusDto, { age: 30, name: 1 }),
    ).resolves.toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Nome inválido',
    });
  });

  it('returns a DTO instance without undeclared fields', async () => {
    const result = await validate(WithStatusDto, {
      name: 'Maria',
      role: 'admin',
    });

    expect(result).toBeInstanceOf(WithStatusDto);
    expect(result).toEqual({ name: 'Maria' });
  });
});
