// Driver do storage que guarda o arquivo em `stored_object.content`
// (decisoes-aprovadas.md §20). Não escala: serve só para a demonstração.

import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, QueryFailedError, Repository } from 'typeorm';
import { StoredObject } from './entities/stored-object.entity';
import { StorageTokenService } from './services/storage-token.service';
import {
  READ_URL_TTL_MINUTES,
  STORAGE_CONFIG,
  type StorageConfig,
} from './storage.config';
import {
  type PutObjectInput,
  type SignedUrl,
  StorageObjectAlreadyExistsError,
  StorageService,
  type StoredObjectContent,
  type StoredObjectInfo,
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

  createReadUrl(fileKey: string, now: Date = new Date()): SignedUrl {
    const expiresAt = new Date(now.getTime() + READ_URL_TTL_MINUTES * 60_000);
    const token = this.tokens.sign(fileKey, 'read', expiresAt);

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

  async headObject(fileKey: string): Promise<StoredObjectInfo | null> {
    const object = await this.objects.findOne({
      where: { fileKey },
      select: { fileKey: true, mimeType: true, sizeBytes: true },
    });

    return object
      ? { mimeType: object.mimeType, sizeBytes: object.sizeBytes }
      : null;
  }

  async getObject(fileKey: string): Promise<StoredObjectContent | null> {
    const object = await this.objects.findOne({
      where: { fileKey },
      select: {
        fileKey: true,
        mimeType: true,
        sizeBytes: true,
        content: true,
      },
    });

    return object
      ? {
          mimeType: object.mimeType,
          sizeBytes: object.sizeBytes,
          content: object.content,
        }
      : null;
  }

  async activateObject(
    fileKey: string,
    manager?: EntityManager,
  ): Promise<void> {
    const objects = manager?.getRepository(StoredObject) ?? this.objects;

    await objects.update({ fileKey }, { active: true });
  }

  async deleteExpiredUnconfirmed(
    olderThanMinutes: number,
    limit: number,
  ): Promise<number> {
    // `document` é conferida por SQL para o storage não depender do módulo de
    // documentos; documento excluído também protege o arquivo (RN021).
    const result = await this.objects
      .createQueryBuilder()
      .delete()
      .from(StoredObject)
      .where(
        `file_key IN (
          SELECT stored.file_key FROM stored_object stored
          WHERE stored.active = false
            AND stored.created_at < now() - make_interval(mins => :minutes)
            AND NOT EXISTS (
              SELECT 1 FROM document WHERE document.file_key = stored.file_key
            )
          LIMIT :limit
        )`,
        { minutes: olderThanMinutes, limit },
      )
      .execute();

    return result.affected ?? 0;
  }
}
