import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Account } from '../src/accounts/entities/account.entity';
import { Professional } from '../src/professionals/entities/professional.entity';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/common/swagger/setup-swagger';

type OpenApiSchema = {
  $ref?: string;
  type?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
};
type OpenApiParameter = {
  name: string;
  in: string;
  required?: boolean;
  schema?: OpenApiSchema;
};
type OpenApiResponse = {
  content?: { 'application/json'?: { schema?: OpenApiSchema } };
};
type OpenApiOperation = {
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: { content: Record<string, { schema?: OpenApiSchema }> };
  security?: Record<string, string[]>[];
  responses: Record<string, OpenApiResponse>;
};
type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, OpenApiSchema>;
    securitySchemes: Record<
      string,
      { type: string; in?: string; name?: string; scheme?: string }
    >;
  };
};

/** Esquema JSON de uma resposta, ou undefined se ela não declarar corpo. */
function responseSchema(
  operation: OpenApiOperation,
  status: string,
): OpenApiSchema | undefined {
  return operation.responses[status]?.content?.['application/json']?.schema;
}

const NEST_ROUTES: Array<[path: string, method: string]> = [
  ['/health', 'get'],
  ['/me', 'get'],
  ['/auth/logout', 'post'],
  ['/professionals', 'get'],
];
const PROTECTED_ROUTES = NEST_ROUTES.filter(([path]) => path !== '/health');
const ERROR_SCHEMA_REF = '#/components/schemas/ErrorResponseDto';

// Sobe o AppModule com o mesmo setupSwagger do main.ts e confere o documento
// publicado. O banco é trocado por dublês, como no health.e2e-spec.ts.
describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue({
        query: async () => [],
        isInitialized: true,
        destroy: async () => undefined,
      } as unknown as DataSource)
      .overrideProvider(getRepositoryToken(Account))
      .useValue({})
      .overrideProvider(getRepositoryToken(Professional))
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function getDocument(): Promise<OpenApiDocument> {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect('Content-Type', /json/);

    return response.body as OpenApiDocument;
  }

  it('GET /docs-json serves an OpenAPI 3 document', async () => {
    const document = await getDocument();

    expect(document.openapi).toMatch(/^3\./);
  });

  it('lists the Nest routes', async () => {
    const { paths } = await getDocument();

    expect(paths['/health']).toHaveProperty('get');
    expect(paths['/me']).toHaveProperty('get');
    expect(paths['/auth/logout']).toHaveProperty('post');
    expect(paths['/professionals']).toHaveProperty('get');
  });

  it('declares the cookie and bearer session schemes', async () => {
    const { securitySchemes } = (await getDocument()).components;

    expect(Object.values(securitySchemes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'apiKey',
          in: 'cookie',
          name: 'sAccessToken',
        }),
        expect.objectContaining({ type: 'http', scheme: 'bearer' }),
      ]),
    );
  });

  it('reads the GET /professionals query parameters from the DTO', async () => {
    const { paths } = await getDocument();
    const parameters = paths['/professionals'].get.parameters ?? [];

    expect(
      parameters.filter((p) => p.in === 'query').map((p) => p.name),
    ).toEqual(
      expect.arrayContaining(['page', 'limit', 'name', 'specialism', 'ids']),
    );
  });

  it.each(NEST_ROUTES)(
    '%s %s has a tag and a 200 response schema',
    async (path, method) => {
      const operation = (await getDocument()).paths[path][method];

      expect(operation.tags?.length).toBeGreaterThan(0);
      expect(responseSchema(operation, '200')).toBeDefined();
    },
  );

  it.each(PROTECTED_ROUTES)(
    '%s %s accepts the cookie or the bearer session and documents 401',
    async (path, method) => {
      const operation = (await getDocument()).paths[path][method];

      expect(operation.security).toEqual(
        expect.arrayContaining([{ cookie: [] }, { bearer: [] }]),
      );
      expect(responseSchema(operation, '401')).toBeDefined();
    },
  );

  it('GET /health is public and documents the 503 body', async () => {
    const operation = (await getDocument()).paths['/health'].get;

    expect(operation.security).toBeUndefined();
    expect(responseSchema(operation, '503')).toBeDefined();
  });

  it('describes the error body as { status, message }', async () => {
    const { schemas } = (await getDocument()).components;

    expect(schemas.ErrorResponseDto).toMatchObject({
      required: expect.arrayContaining(['status', 'message']),
      properties: { status: { type: 'string' }, message: { type: 'string' } },
    });
  });

  it.each([
    ['/professionals', 'get', '400'],
    ['/professionals', 'get', '500'],
    ['/auth/logout', 'post', '400'],
  ])('%s %s answers %s with the error body', async (path, method, status) => {
    const operation = (await getDocument()).paths[path][method];

    expect(responseSchema(operation, status)?.$ref).toBe(ERROR_SCHEMA_REF);
  });

  it('documents the GET /professionals defaults and limits', async () => {
    const parameters = (await getDocument()).paths['/professionals'].get
      .parameters;
    const byName = Object.fromEntries(
      (parameters ?? []).map((parameter) => [parameter.name, parameter]),
    );

    expect(byName.page).toMatchObject({
      required: false,
      schema: { type: 'integer', default: 1, minimum: 1 },
    });
    expect(byName.limit).toMatchObject({
      required: false,
      schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
    });
    expect(byName.ids).toMatchObject({
      required: false,
      schema: { type: 'string' },
    });
    expect(byName.name).toMatchObject({ required: false });
    expect(byName.specialism).toMatchObject({ required: false });
  });

  it.each(['/auth/signup', '/auth/signin'])(
    'POST %s documents formFields, the rid header and the SDK statuses',
    async (path) => {
      const operation = (await getDocument()).paths[path].post;
      const headers = (operation.parameters ?? []).filter(
        (parameter) => parameter.in === 'header',
      );

      expect(operation.tags).toEqual(['auth']);
      expect(
        operation.requestBody?.content['application/json']?.schema?.required,
      ).toEqual(['formFields']);
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'rid', required: true }),
          expect.objectContaining({ name: 'st-auth-mode' }),
        ]),
      );
      expect(responseSchema(operation, '200')).toBeDefined();
    },
  );

  it('POST /auth/session/refresh uses the refresh token', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/auth/session/refresh'].post;

    expect(operation.tags).toEqual(['auth']);
    expect(operation.security).toEqual([{ refresh: [] }]);
    expect(components.securitySchemes.refresh).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(responseSchema(operation, '200')).toBeDefined();
    expect(responseSchema(operation, '401')).toBeDefined();
  });

  it('leaves out the disabled /auth/signout', async () => {
    const { paths } = await getDocument();

    expect(paths['/auth/signout']).toBeUndefined();
  });

  it('GET /docs serves the Swagger UI', async () => {
    await request(app.getHttpServer())
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/);
  });
});
