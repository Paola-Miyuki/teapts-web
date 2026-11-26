// Configuração tipada do storage, lida das variáveis de ambiente pelo
// ConfigService. Sem STORAGE_TOKEN_SECRET (ausente ou vazio), gera um segredo
// aleatório a cada subida: as URLs de envio ainda abertas deixam de valer ao
// reiniciar, e com mais de uma instância é preciso definir o mesmo valor.

import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

export const STORAGE_CONFIG = Symbol('STORAGE_CONFIG');

const DEFAULT_UPLOAD_URL_TTL_MINUTES = 15;
const DEFAULT_CLEANUP_INTERVAL_MINUTES = 60;
const DEFAULT_UNCONFIRMED_TTL_MINUTES = 1440;

/** Validade da URL de leitura, em minutos; o front pede outra a cada clique. */
export const READ_URL_TTL_MINUTES = 5;

export type StorageConfig = {
  /** Segredo do HMAC das URLs assinadas. */
  tokenSecret: string;
  /** Validade da URL de envio, em minutos. */
  uploadUrlTtlMinutes: number;
  /** De quanto em quanto tempo roda a limpeza dos uploads não confirmados. */
  cleanupIntervalMinutes: number;
  /** Idade, em minutos, a partir da qual um upload não confirmado é removido. */
  unconfirmedTtlMinutes: number;
  /** Base das URLs do storage: o próprio backend (`API_DOMAIN`), sem `/` final. */
  baseUrl: string;
};

function readPositiveInteger(
  configService: ConfigService,
  name: string,
  fallback: number,
): number {
  const raw = configService.get<string>(name);
  const value = raw === undefined || raw === '' ? fallback : Number(raw);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

export function getStorageConfig(configService: ConfigService): StorageConfig {
  const tokenSecret =
    configService.get<string>('STORAGE_TOKEN_SECRET')?.trim() ||
    randomBytes(32).toString('hex');

  const uploadUrlTtlMinutes = readPositiveInteger(
    configService,
    'STORAGE_UPLOAD_URL_TTL_MINUTES',
    DEFAULT_UPLOAD_URL_TTL_MINUTES,
  );
  const cleanupIntervalMinutes = readPositiveInteger(
    configService,
    'STORAGE_CLEANUP_INTERVAL_MINUTES',
    DEFAULT_CLEANUP_INTERVAL_MINUTES,
  );
  const unconfirmedTtlMinutes = readPositiveInteger(
    configService,
    'STORAGE_UNCONFIRMED_TTL_MINUTES',
    DEFAULT_UNCONFIRMED_TTL_MINUTES,
  );

  // Um upload ainda dentro da validade da URL pode ser confirmado: a janela
  // da limpeza precisa ser maior que ela.
  if (unconfirmedTtlMinutes <= uploadUrlTtlMinutes) {
    throw new Error(
      'STORAGE_UNCONFIRMED_TTL_MINUTES must be greater than STORAGE_UPLOAD_URL_TTL_MINUTES',
    );
  }

  return {
    tokenSecret,
    uploadUrlTtlMinutes,
    cleanupIntervalMinutes,
    unconfirmedTtlMinutes,
    baseUrl: configService.getOrThrow<string>('API_DOMAIN').replace(/\/+$/, ''),
  };
}
