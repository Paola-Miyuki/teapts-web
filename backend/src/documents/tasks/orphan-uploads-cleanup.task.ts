// Este arquivo agenda a limpeza dos uploads não confirmados (RFDOC004) com um
// `setInterval` simples, sem `@nestjs/schedule`. Várias instâncias podem
// rodar ao mesmo tempo: o `DELETE` é idempotente (decisoes-aprovadas.md §20).

import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  STORAGE_CONFIG,
  type StorageConfig,
} from '../../storage/storage.config';
import { OrphanUploadsCleanupService } from '../services/orphan-uploads-cleanup.service';

@Injectable()
export class OrphanUploadsCleanupTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrphanUploadsCleanupTask.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly cleanup: OrphanUploadsCleanupService,
    @Inject(STORAGE_CONFIG) private readonly config: StorageConfig,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.tick(),
      this.config.cleanupIntervalMinutes * 60_000,
    );
    // O agendamento sozinho não mantém o processo vivo.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Uma execução; ignora o disparo se a anterior ainda não terminou. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.cleanup.run();
    } catch (error) {
      this.logger.error(
        'Falha na limpeza de uploads não confirmados',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
