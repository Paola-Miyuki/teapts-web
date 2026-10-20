// Este arquivo cria o ValidationPipe global da API.
// Os erros de validação seguem o formato `{ status, message }` da documentação:
// a mensagem vem do DTO, e o status vem do `context` da constraint.

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/** Status usado quando a constraint não declara `context.status`. */
export const DEFAULT_VALIDATION_STATUS = 'VALIDATION_ERROR';

const DEFAULT_VALIDATION_MESSAGE = 'Requisição inválida.';

type ConstraintContext = { status?: string };

/**
 * Procura, em profundidade, o primeiro erro que tem constraints.
 * Erros de objetos aninhados só trazem as constraints nos filhos.
 */
function findFirstConstraintError(
  errors: ValidationError[],
): ValidationError | undefined {
  for (const error of errors) {
    if (error.constraints && Object.keys(error.constraints).length > 0) {
      return error;
    }

    const child = findFirstConstraintError(error.children ?? []);

    if (child) {
      return child;
    }
  }

  return undefined;
}

/**
 * Converte os erros do class-validator no corpo de erro da API.
 *
 * Usa só o primeiro erro: a primeira propriedade inválida e a primeira
 * constraint dela.
 *
 * @param errors erros produzidos pelo class-validator
 * @returns exceção HTTP 400 com `{ status, message }`
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const error = findFirstConstraintError(errors);
  const [constraint, message] =
    Object.entries(error?.constraints ?? {})[0] ?? [];
  const context = (error?.contexts?.[constraint ?? ''] ??
    {}) as ConstraintContext;

  return new BadRequestException({
    status: context.status ?? DEFAULT_VALIDATION_STATUS,
    message: message ?? DEFAULT_VALIDATION_MESSAGE,
  });
}

/**
 * Cria o ValidationPipe compartilhado por `main.ts`, `create-app.ts` e testes.
 *
 * `transform` entrega instâncias dos DTOs ao controller, e `whitelist`
 * remove os campos que o DTO não declara.
 *
 * @returns pipe de validação configurado
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: validationExceptionFactory,
  });
}
