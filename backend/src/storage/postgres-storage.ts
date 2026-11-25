// Driver do storage que guarda o arquivo em `stored_object.content`
// (decisoes-aprovadas.md §20). Não escala: serve só para a demonstração.

import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { StoredObject } from './entities/stored-object.entity';
import { StorageTokenService } from './services/storage-token.service';
import { STORAGE_CONFIG, type StorageConfig } from './storage.config';
import {
  type PutObjectInput,
  type SignedUrl,
  StorageObjectAlreadyExistsError,
  StorageService,
} from './storage.service';

/** Código do Postgres para violação de chave única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class PostgresStorage extends StorageService {
  constructor(
    @InjectRepository(StoredObject)
    private readonly objects: Repository<StoredObject>,
    private readonly tokens: StorageTokenService,
    @Inject(STORAGE_CONFIG) private readonly config: StorageConfig,
  ) {
    super();
  }

  createUploadUrl(
    fileKey: string,
    mimeType: string,
    now: Date = new Date(),
  ): SignedUrl {
    const expiresAt = new Date(
      now.getTime() + this.config.uploadUrlTtlMinutes * 60_000,
    );
    const token = this.tokens.sign(fileKey, 'write', expiresAt, { mimeType });

    return {
      url: `${this.config.baseUrl}/storage/objects/${encodeURIComponent(fileKey)}?token=${token}`,
      expiresAt,
    };
  }

  async putObject({
    fileKey,
    mimeType,
    content,
  }: PutObjectInput): Promise<void> {
    try {
      await this.objects.insert({
        fileKey,
        mimeType,
        sizeBytes: content.length,
        content,
        active: false,
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: unknown } | undefined)?.code ===
          UNIQUE_VIOLATION
      ) {
        throw new StorageObjectAlreadyExistsError(fileKey);
      }

      throw error;
    }
  }
}
