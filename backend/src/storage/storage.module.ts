import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageObjectsController } from './controllers/storage-objects.controller';
import { StoredObject } from './entities/stored-object.entity';
import { PostgresStorage } from './postgres-storage';
import { StorageTokenService } from './services/storage-token.service';
import { getStorageConfig, STORAGE_CONFIG } from './storage.config';
import { StorageService } from './storage.service';

/**
 * Storage de arquivos: a porta `StorageService` (driver PostgresStorage) e o
 * token das URLs assinadas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([StoredObject])],
  controllers: [StorageObjectsController],
  providers: [
    {
      provide: STORAGE_CONFIG,
      inject: [ConfigService],
      useFactory: getStorageConfig,
    },
    StorageTokenService,
    { provide: StorageService, useClass: PostgresStorage },
  ],
  exports: [StorageService, StorageTokenService],
})
export class StorageModule {}
