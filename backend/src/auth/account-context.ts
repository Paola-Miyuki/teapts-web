// Este arquivo valida o payload recebido de uma sessão.
// O guard chama esta função antes de liberar uma rota protegida.
// A validação evita que controllers usem dados ausentes ou com formato errado.
// O contexto validado é entregue depois pelo decorator @CurrentAccount().

import { UnauthorizedException } from '@nestjs/common';
import type { AccountContext } from '../accounts/accounts.service';
import { AccountRole } from '../database/enums/account-role.enum';

const ACCOUNT_ROLES: readonly unknown[] = Object.values(AccountRole);

/**
 * Cria o erro padrão usado quando o payload não representa uma conta válida.
 *
 * @returns exceção HTTP 401 sem revelar detalhes do payload
 */
function payloadInvalido(): UnauthorizedException {
  return new UnauthorizedException('Payload de sessão inválido');
}

/**
 * Valida o contrato mínimo do contexto da conta gravado no access token.
 *
 * @param payload valor lido da sessão
 * @returns contexto tipado e validado
 * @throws UnauthorizedException quando o payload não atende ao contrato
 */
export function parseAccountContext(payload: unknown): AccountContext {
  if (payload === null || typeof payload !== 'object') {
    throw payloadInvalido();
  }

  const value = payload as Record<string, unknown>;
  const { accountId, role, patientProfileId, professionalProfileIds } = value;

  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw payloadInvalido();
  }

  // Sessões criadas antes de `role` entrar no payload exigem novo login.
  if (!ACCOUNT_ROLES.includes(role)) {
    throw payloadInvalido();
  }

  if (patientProfileId !== null && typeof patientProfileId !== 'string') {
    throw payloadInvalido();
  }

  if (
    !Array.isArray(professionalProfileIds) ||
    professionalProfileIds.some((profileId) => typeof profileId !== 'string')
  ) {
    throw payloadInvalido();
  }

  return {
    accountId,
    role: role as AccountRole,
    patientProfileId,
    professionalProfileIds,
  };
}
