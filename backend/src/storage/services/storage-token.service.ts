// Este arquivo assina e valida os tokens das URLs do storage. O token é um
// HMAC-SHA256 sobre o objeto, a operação e o vencimento, então só vale para
// aquele `fileKey` e aquela operação, até `expiresAt`.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_CONFIG, type StorageConfig } from '../storage.config';

export type StorageOperation = 'write' | 'read';

type TokenPayload = { k: string; op: StorageOperation; exp: number };

function base64url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

@Injectable()
export class StorageTokenService {
  constructor(@Inject(STORAGE_CONFIG) private readonly config: StorageConfig) {}

  /** Assina um token para a operação no objeto, válido até `expiresAt`. */
  sign(fileKey: string, operation: StorageOperation, expiresAt: Date): string {
    const payload = base64url(
      JSON.stringify({
        k: fileKey,
        op: operation,
        exp: expiresAt.getTime(),
      } satisfies TokenPayload),
    );

    return `${payload}.${this.signature(payload)}`;
  }

  /**
   * Confere assinatura, objeto, operação e vencimento.
   *
   * @returns `true` só quando o token é deste `fileKey` e desta operação e
   *   ainda não venceu
   */
  verify(
    token: string,
    fileKey: string,
    operation: StorageOperation,
    now: Date = new Date(),
  ): boolean {
    const [payload, signature, ...rest] = token.split('.');

    if (!payload || !signature || rest.length > 0) {
      return false;
    }

    const expected = Buffer.from(this.signature(payload));
    const received = Buffer.from(signature);

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return false;
    }

    let data: Partial<TokenPayload>;

    try {
      data = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Partial<TokenPayload>;
    } catch {
      return false;
    }

    return (
      data.k === fileKey &&
      data.op === operation &&
      typeof data.exp === 'number' &&
      data.exp > now.getTime()
    );
  }

  private signature(payload: string) {
    return createHmac('sha256', this.config.tokenSecret)
      .update(payload)
      .digest('base64url');
  }
}
