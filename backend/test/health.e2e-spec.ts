import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Account } from '../src/accounts/account.entity';
import { AppModule } from '../src/app.module';

// Sobe o AppModule inteiro (Config + TypeOrm + Health) e exercita as rotas por
// HTTP. A DataSource e substituida por um dublê: o driver pg nao carrega sob o
// ESM do Jest, e a conexao real e verificada por `pnpm migration:run`.
const probe = jest.fn<(sql: string) => Promise<unknown>>();

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue({
        query: probe,
        isInitialized: true,
        destroy: async () => undefined,
      } as unknown as DataSource)
      // O repositorio de contas (login) dependeria dos metadados da DataSource.
      .overrideProvider(getRepositoryToken(Account))
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health reports a healthy database', async () => {
    probe.mockResolvedValue([{ '1': 1 }]);

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('GET /health answers 503 when the database is unreachable', async () => {
    probe.mockRejectedValue(new Error('connection refused'));

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect({ status: 'degraded', database: 'down' });
  });

  it('GET / has no route', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });
});
