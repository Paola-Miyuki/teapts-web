import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

// A config do Jest roda em ESM, entao o objeto `jest` vem de @jest/globals.
const probe = jest.fn<(sql: string) => Promise<unknown>>();

async function createController(): Promise<HealthController> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: getDataSourceToken(),
        useValue: { query: probe } as unknown as DataSource,
      },
    ],
  }).compile();

  moduleRef.useLogger(false);

  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    controller = await createController();
  });

  it('reports the database as up when the probe query succeeds', async () => {
    probe.mockResolvedValue([{ '1': 1 }]);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(probe).toHaveBeenCalledWith('SELECT 1');
  });

  it('fails with 503 when the probe query throws', async () => {
    probe.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('describes the outage in the 503 payload', async () => {
    probe.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toMatchObject({
      response: { status: 'degraded', database: 'down' },
    });
  });
});
