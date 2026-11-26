// Este arquivo é a regra da limpeza dos uploads não confirmados (RFDOC004):
// remove do storage os objetos enviados que ninguém confirmou dentro da janela.
// Nunca remove objeto ativo nem com registro em `document` (inclusive excluído,
// RN021); a proteção está na consulta do storage. A rotina é idempotente.

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  STORAGE_CONFIG,
  type StorageConfig,
} from '../../storage/storage.config';
import { StorageService } from '../../storage/storage.service';

/** Objetos removidos por rodada, para não segurar uma transação longa. */
export const CLEANUP_BATCH_SIZE = 100;

export type CleanupResult = { removed: number; failures: number };

@Injectable()
export class OrphanUploadsCleanupService {
  private readonly logger = new Logger(OrphanUploadsCleanupService.name);

  constructor(
    private readonly storage: StorageService,
    @Inject(STORAGE_CONFIG) private readonly config: StorageConfig,
  ) {}

  /**
   * Remove, em lotes, os objetos não confirmados mais antigos que a janela.
   * Falha de um lote é logada e encerra a rodada; a próxima execução tenta de
   * novo. Ao fim, registra em log quantos foram removidos e quantas falhas.
   */
  async run(): Promise<CleanupResult> {
    let removed = 0;
    let failures = 0;

    for (;;) {
      let count: number;

      try {
        count = await this.storage.deleteExpiredUnconfirmed(
          this.config.unconfirmedTtlMinutes,
          CLEANUP_BATCH_SIZE,
        );
      } catch (error) {
        failures += 1;
        this.logger.error(
          'Falha ao remover uploads não confirmados',
          error instanceof Error ? error.stack : String(error),
        );
        break;
      }

      removed += count;

      if (count < CLEANUP_BATCH_SIZE) {
        break;
      }
    }

    this.logger.log(
      `Uploads não confirmados removidos: ${removed}; falhas: ${failures}`,
    );

    return { removed, failures };
  }
}
