// Configuração tipada do storage, lida das variáveis de ambiente pelo
// ConfigService. A falta de STORAGE_TOKEN_SECRET derruba a subida, sem expor
// o valor de nenhum segredo.

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
  const tokenSecret = configService.getOrThrow<string>('STORAGE_TOKEN_SECRET');

  if (!tokenSecret.trim()) {
    throw new Error('STORAGE_TOKEN_SECRET must not be empty');
  }

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
