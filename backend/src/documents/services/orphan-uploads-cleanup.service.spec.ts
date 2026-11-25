import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { StorageConfig } from '../../storage/storage.config';
import type { StorageService } from '../../storage/storage.service';
import {
  CLEANUP_BATCH_SIZE,
  OrphanUploadsCleanupService,
} from './orphan-uploads-cleanup.service';

const config: StorageConfig = {
  tokenSecret: 'secret',
  uploadUrlTtlMinutes: 15,
  cleanupIntervalMinutes: 60,
  unconfirmedTtlMinutes: 1440,
  baseUrl: 'http://localhost:3000',
};

function createService() {
  const storage = {
    deleteExpiredUnconfirmed:
      jest.fn<StorageService['deleteExpiredUnconfirmed']>(),
  };
  const service = new OrphanUploadsCleanupService(
    storage as unknown as StorageService,
    config,
  );

  return { storage, service };
}

describe('OrphanUploadsCleanupService.run', () => {
  let log: jest.SpiedFunction<Logger['log']>;
  let error: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('removes the expired unconfirmed objects with the configured window and logs the amount', async () => {
    const { storage, service } = createService();
    storage.deleteExpiredUnconfirmed.mockResolvedValue(2);

    await expect(service.run()).resolves.toEqual({ removed: 2, failures: 0 });

    expect(storage.deleteExpiredUnconfirmed).toHaveBeenCalledTimes(1);
    expect(storage.deleteExpiredUnconfirmed).toHaveBeenCalledWith(
      1440,
      CLEANUP_BATCH_SIZE,
    );
    expect(log).toHaveBeenCalledWith(
      'Uploads não confirmados removidos: 2; falhas: 0',
    );
  });

  it('repeats in batches until a batch comes back incomplete', async () => {
    const { storage, service } = createService();
    storage.deleteExpiredUnconfirmed
      .mockResolvedValueOnce(CLEANUP_BATCH_SIZE)
      .mockResolvedValueOnce(CLEANUP_BATCH_SIZE)
      .mockResolvedValueOnce(7);

    await expect(service.run()).resolves.toEqual({
      removed: CLEANUP_BATCH_SIZE * 2 + 7,
      failures: 0,
    });
    expect(storage.deleteExpiredUnconfirmed).toHaveBeenCalledTimes(3);
  });

  it('is idempotent: a second run finds nothing left to remove', async () => {
    const { storage, service } = createService();
    storage.deleteExpiredUnconfirmed
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0);

    await expect(service.run()).resolves.toEqual({ removed: 4, failures: 0 });
    await expect(service.run()).resolves.toEqual({ removed: 0, failures: 0 });
  });

  it('logs a failure, keeps what was already removed and does not throw', async () => {
    const { storage, service } = createService();
    storage.deleteExpiredUnconfirmed
      .mockResolvedValueOnce(CLEANUP_BATCH_SIZE)
      .mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.run()).resolves.toEqual({
      removed: CLEANUP_BATCH_SIZE,
      failures: 1,
    });
    expect(error).toHaveBeenCalledWith(
      'Falha ao remover uploads não confirmados',
      expect.stringContaining('connection lost'),
    );
    expect(log).toHaveBeenCalledWith(
      `Uploads não confirmados removidos: ${CLEANUP_BATCH_SIZE}; falhas: 1`,
    );
  });
});
