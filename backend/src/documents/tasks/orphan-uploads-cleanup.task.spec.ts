import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { StorageConfig } from '../../storage/storage.config';
import type { OrphanUploadsCleanupService } from '../services/orphan-uploads-cleanup.service';
import { OrphanUploadsCleanupTask } from './orphan-uploads-cleanup.task';

const config: StorageConfig = {
  tokenSecret: 'secret',
  uploadUrlTtlMinutes: 15,
  cleanupIntervalMinutes: 30,
  unconfirmedTtlMinutes: 1440,
  baseUrl: 'http://localhost:3000',
};
const INTERVAL_MS = 30 * 60_000;

function createTask() {
  const cleanup = {
    run: jest.fn<OrphanUploadsCleanupService['run']>(),
  };
  cleanup.run.mockResolvedValue({ removed: 0, failures: 0 });

  const task = new OrphanUploadsCleanupTask(
    cleanup as unknown as OrphanUploadsCleanupService,
    config,
  );

  return { cleanup, task };
}

describe('OrphanUploadsCleanupTask', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs the cleanup at each configured interval', async () => {
    const { cleanup, task } = createTask();

    task.onModuleInit();
    expect(cleanup.run).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(cleanup.run).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(cleanup.run).toHaveBeenCalledTimes(2);

    task.onModuleDestroy();
  });

  it('does not overlap runs while the previous one is still going', async () => {
    const { cleanup, task } = createTask();
    let finish: () => void = () => undefined;
    cleanup.run.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve({ removed: 0, failures: 0 });
      }),
    );

    task.onModuleInit();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(cleanup.run).toHaveBeenCalledTimes(1);

    finish();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(cleanup.run).toHaveBeenCalledTimes(2);

    task.onModuleDestroy();
  });

  it('survives an error and keeps running on the next interval', async () => {
    const { cleanup, task } = createTask();
    cleanup.run.mockRejectedValueOnce(new Error('boom'));

    task.onModuleInit();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(cleanup.run).toHaveBeenCalledTimes(2);

    task.onModuleDestroy();
  });

  it('stops the schedule on destroy', async () => {
    const { cleanup, task } = createTask();

    task.onModuleInit();
    task.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS * 3);

    expect(cleanup.run).not.toHaveBeenCalled();
  });
});
