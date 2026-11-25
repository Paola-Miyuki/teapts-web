// Configuração tipada do storage, lida das variáveis de ambiente pelo
// ConfigService. Sem STORAGE_TOKEN_SECRET (ausente ou vazio), gera um segredo
// aleatório a cada subida: as URLs de envio ainda abertas deixam de valer ao
// reiniciar, e com mais de uma instância é preciso definir o mesmo valor.

import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

export const STORAGE_CONFIG = Symbol('STORAGE_CONFIG');

const DEFAULT_UPLOAD_URL_TTL_MINUTES = 15;

export type StorageConfig = {
  /** Segredo do HMAC das URLs assinadas. */
  tokenSecret: string;
  /** Validade da URL de envio, em minutos. */
  uploadUrlTtlMinutes: number;
  /** Base das URLs do storage: o próprio backend (`API_DOMAIN`), sem `/` final. */
  baseUrl: string;
};

export function getStorageConfig(configService: ConfigService): StorageConfig {
  const tokenSecret =
    configService.get<string>('STORAGE_TOKEN_SECRET')?.trim() ||
    randomBytes(32).toString('hex');

  const rawTtl = configService.get<string>('STORAGE_UPLOAD_URL_TTL_MINUTES');
  const uploadUrlTtlMinutes =
    rawTtl === undefined || rawTtl === ''
      ? DEFAULT_UPLOAD_URL_TTL_MINUTES
      : Number(rawTtl);

  if (!Number.isInteger(uploadUrlTtlMinutes) || uploadUrlTtlMinutes < 1) {
    throw new Error(
      'STORAGE_UPLOAD_URL_TTL_MINUTES must be a positive integer',
    );
  }

  return {
    tokenSecret,
    uploadUrlTtlMinutes,
    baseUrl: configService.getOrThrow<string>('API_DOMAIN').replace(/\/+$/, ''),
  };
}
