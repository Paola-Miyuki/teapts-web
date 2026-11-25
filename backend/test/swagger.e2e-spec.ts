import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Account } from '../src/accounts/entities/account.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { Professional } from '../src/professionals/entities/professional.entity';
import { PtsEntity } from '../src/pts/entities/pts.entity';
import { StoredObject } from '../src/storage/entities/stored-object.entity';
import { STORAGE_CONFIG } from '../src/storage/storage.config';
import { ActivityEntity } from '../src/activities/entities/activity.entity';
import { PtsGoalEntity } from '../src/pts/entities/pts-goal.entity';
import { TimelineRecordEntity } from '../src/timeline/entities/timeline-record.entity';
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
  content?: {
    'application/json'?: {
      schema?: OpenApiSchema;
      examples?: Record<string, { value: unknown }>;
    };
  };
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
  ['/me', 'patch'],
  ['/me/password', 'post'],
  ['/auth/logout', 'post'],
  ['/professionals', 'get'],
  ['/pts/proposals', 'get'],
  ['/pts/proposals/{id}', 'get'],
  ['/pts/active', 'get'],
  ['/pts/proposals/{id}', 'patch'],
  ['/pts/{id}/start', 'post'],
  ['/pts/{id}/close', 'post'],
  ['/pts/{id}/reassessment', 'post'],
  ['/pts/{id}/team/{professionalId}', 'delete'],
  ['/pts/{id}/timeline', 'get'],
  ['/pts/{id}/activities', 'get'],
  ['/pts/{id}/activities', 'post'],
  ['/activities/{id}', 'get'],
  ['/activities/{id}', 'patch'],
  ['/activities/{id}/archive', 'post'],
  ['/activities/{id}/suspend', 'post'],
  ['/activities/{id}/resume', 'post'],
  ['/activities/{id}/conclude', 'post'],
  ['/notifications', 'get'],
  ['/notifications/unread-count', 'get'],
  ['/notifications/{id}/read', 'post'],
  ['/notifications/read-all', 'post'],
  ['/pts/{id}/goals', 'get'],
  ['/pts/{id}/goals', 'post'],
  ['/pts/{id}/goals/{goalId}', 'patch'],
  ['/pts/{id}/goals/{goalId}', 'delete'],
  ['/pts/proposals/{id}', 'delete'],
  ['/patients/authorized', 'get'],
  ['/accounts', 'get'],
  ['/accounts/{id}', 'get'],
  ['/accounts/{id}', 'delete'],
  ['/me', 'delete'],
  ['/patients', 'post'],
  ['/patients/{patientId}/support-contacts', 'get'],
  ['/patients/{patientId}/support-contacts', 'post'],
  ['/patients/{patientId}/support-contacts/{contactId}', 'patch'],
  ['/professionals', 'post'],
  ['/patients/{id}/documents/upload-url', 'post'],
  ['/documents/{id}', 'patch'],
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
        entityMetadatas: [],
        options: { type: 'postgres' },
        getRepository: () => ({}),
      } as unknown as DataSource)
      .overrideProvider(getRepositoryToken(Account))
      .useValue({})
      .overrideProvider(getRepositoryToken(Professional))
      .useValue({})
      .overrideProvider(getRepositoryToken(Patient))
      .useValue({})
      .overrideProvider(getRepositoryToken(PtsEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(ActivityEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(PtsGoalEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(TimelineRecordEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(StoredObject))
      .useValue({})
      .overrideProvider(STORAGE_CONFIG)
      .useValue({
        tokenSecret: 'test-secret',
        uploadUrlTtlMinutes: 15,
        baseUrl: 'http://localhost:3000',
      })
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
    expect(paths['/me']).toHaveProperty('patch');
    expect(paths['/me/password']).toHaveProperty('post');
    expect(paths['/auth/logout']).toHaveProperty('post');
    expect(paths['/professionals']).toHaveProperty('get');
    expect(paths['/patients/authorized']).toHaveProperty('get');
    expect(paths['/accounts']).toHaveProperty('get');
    expect(paths['/patients']).toHaveProperty('post');
    expect(paths['/professionals']).toHaveProperty('post');
    expect(paths['/documents/{id}']).toHaveProperty('patch');
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
      expect.arrayContaining([
        'page',
        'limit',
        'q',
        'specialism',
        'council',
        'councilState',
        'sort',
        'order',
        'ids',
      ]),
    );
  });

  it('documenta os parâmetros e limites de GET /pts/proposals', async () => {
    const operation = (await getDocument()).paths['/pts/proposals'].get;
    const parameters = operation.parameters ?? [];
    const byName = Object.fromEntries(
      parameters
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => [parameter.name, parameter]),
    );

    expect(byName.patientId).toMatchObject({
      required: false,
      schema: { type: 'string', format: 'uuid' },
    });
    expect(byName.q).toMatchObject({
      required: false,
      schema: { type: 'string' },
    });

    expect(byName.page).toMatchObject({
      required: false,
      schema: { type: 'integer', default: 1, minimum: 1 },
    });

    expect(byName.limit).toMatchObject({
      required: false,
      schema: {
        type: 'integer',
        default: 20,
        minimum: 1,
        maximum: 50,
      },
    });
  });

  it.each(NEST_ROUTES)(
    '%s %s has a tag and a success response schema',
    async (path, method) => {
      const operation = (await getDocument()).paths[path][method];
      const created = [
        '/patients',
        '/professionals',
        '/patients/{patientId}/support-contacts',
        '/pts/{id}/goals',
        '/pts/{id}/activities',
        '/patients/{id}/documents/upload-url',
      ].includes(path);
      const success = method === 'post' && created ? '201' : '200';

      expect(operation.tags?.length).toBeGreaterThan(0);
      expect(responseSchema(operation, success)).toBeDefined();
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
    ['/patients/authorized', 'get', '400'],
    ['/patients/authorized', 'get', '500'],
    ['/accounts', 'get', '400'],
    ['/pts/{id}/close', 'post', '400'],
    ['/pts/{id}/close', 'post', '403'],
    ['/pts/{id}/close', 'post', '404'],
    ['/pts/{id}/close', 'post', '409'],
    ['/pts/{id}/reassessment', 'post', '400'],
    ['/pts/{id}/reassessment', 'post', '403'],
    ['/pts/{id}/reassessment', 'post', '404'],
    ['/pts/{id}/reassessment', 'post', '409'],
    ['/pts/{id}/start', 'post', '400'],
    ['/pts/{id}/start', 'post', '403'],
    ['/pts/{id}/start', 'post', '404'],
    ['/pts/{id}/start', 'post', '409'],
    ['/pts/{id}/team/{professionalId}', 'delete', '400'],
    ['/pts/{id}/team/{professionalId}', 'delete', '403'],
    ['/pts/{id}/team/{professionalId}', 'delete', '404'],
    ['/pts/{id}/team/{professionalId}', 'delete', '409'],
    ['/pts/{id}/timeline', 'get', '400'],
    ['/pts/{id}/timeline', 'get', '403'],
    ['/pts/{id}/timeline', 'get', '404'],
    ['/pts/{id}/activities', 'get', '400'],
    ['/pts/{id}/activities', 'get', '403'],
    ['/pts/{id}/activities', 'get', '404'],
    ['/pts/{id}/activities', 'post', '400'],
    ['/pts/{id}/activities', 'post', '403'],
    ['/pts/{id}/activities', 'post', '404'],
    ['/pts/{id}/activities', 'post', '409'],
    ['/pts/{id}/activities', 'post', '422'],
    ['/activities/{id}', 'get', '400'],
    ['/activities/{id}', 'get', '403'],
    ['/activities/{id}', 'get', '404'],
    ['/activities/{id}', 'patch', '400'],
    ['/activities/{id}', 'patch', '403'],
    ['/activities/{id}', 'patch', '404'],
    ['/activities/{id}', 'patch', '409'],
    ['/activities/{id}', 'patch', '422'],
    ['/activities/{id}/suspend', 'post', '400'],
    ['/activities/{id}/suspend', 'post', '403'],
    ['/activities/{id}/suspend', 'post', '404'],
    ['/activities/{id}/suspend', 'post', '409'],
    ['/activities/{id}/resume', 'post', '400'],
    ['/activities/{id}/resume', 'post', '403'],
    ['/activities/{id}/resume', 'post', '404'],
    ['/activities/{id}/resume', 'post', '409'],
    ['/activities/{id}/conclude', 'post', '400'],
    ['/activities/{id}/conclude', 'post', '403'],
    ['/activities/{id}/conclude', 'post', '404'],
    ['/activities/{id}/conclude', 'post', '409'],
    ['/activities/{id}/archive', 'post', '400'],
    ['/activities/{id}/archive', 'post', '403'],
    ['/activities/{id}/archive', 'post', '404'],
    ['/activities/{id}/archive', 'post', '409'],
    ['/notifications', 'get', '400'],
    ['/notifications/{id}/read', 'post', '400'],
    ['/notifications/{id}/read', 'post', '404'],
    ['/pts/{id}/goals', 'get', '400'],
    ['/pts/{id}/goals', 'get', '403'],
    ['/pts/{id}/goals', 'get', '404'],
    ['/pts/{id}/goals', 'post', '400'],
    ['/pts/{id}/goals', 'post', '403'],
    ['/pts/{id}/goals', 'post', '404'],
    ['/pts/{id}/goals', 'post', '409'],
    ['/pts/{id}/goals/{goalId}', 'patch', '400'],
    ['/pts/{id}/goals/{goalId}', 'patch', '403'],
    ['/pts/{id}/goals/{goalId}', 'patch', '404'],
    ['/pts/{id}/goals/{goalId}', 'patch', '409'],
    ['/pts/{id}/goals/{goalId}', 'delete', '400'],
    ['/pts/{id}/goals/{goalId}', 'delete', '403'],
    ['/pts/{id}/goals/{goalId}', 'delete', '404'],
    ['/pts/{id}/goals/{goalId}', 'delete', '409'],
    ['/accounts', 'get', '403'],
    ['/accounts', 'get', '500'],
    ['/accounts/{id}', 'get', '400'],
    ['/accounts/{id}', 'get', '403'],
    ['/accounts/{id}', 'get', '404'],
    ['/accounts/{id}', 'get', '500'],
    ['/accounts/{id}', 'delete', '400'],
    ['/accounts/{id}', 'delete', '403'],
    ['/accounts/{id}', 'delete', '404'],
    ['/accounts/{id}', 'delete', '409'],
    ['/accounts/{id}', 'delete', '500'],
    ['/me', 'delete', '404'],
    ['/me', 'delete', '409'],
    ['/me', 'delete', '500'],
    ['/patients', 'post', '400'],
    ['/patients', 'post', '403'],
    ['/patients', 'post', '404'],
    ['/patients', 'post', '409'],
    ['/patients', 'post', '500'],
    ['/patients/{patientId}/support-contacts', 'get', '400'],
    ['/patients/{patientId}/support-contacts', 'get', '403'],
    ['/patients/{patientId}/support-contacts', 'get', '404'],
    ['/patients/{patientId}/support-contacts', 'get', '500'],
    ['/patients/{patientId}/support-contacts', 'post', '400'],
    ['/patients/{patientId}/support-contacts', 'post', '403'],
    ['/patients/{patientId}/support-contacts', 'post', '404'],
    ['/patients/{patientId}/support-contacts', 'post', '500'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'patch', '400'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'patch', '403'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'patch', '404'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'patch', '500'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'delete', '400'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'delete', '403'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'delete', '404'],
    ['/patients/{patientId}/support-contacts/{contactId}', 'delete', '500'],
    ['/professionals', 'post', '400'],
    ['/professionals', 'post', '403'],
    ['/professionals', 'post', '404'],
    ['/professionals', 'post', '409'],
    ['/professionals', 'post', '500'],
    ['/pts/proposals/{id}', 'delete', '400'],
    ['/pts/proposals/{id}', 'delete', '403'],
    ['/pts/proposals/{id}', 'delete', '404'],
    ['/pts/proposals/{id}', 'delete', '409'],
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
      schema: { type: 'integer', default: 20, minimum: 1, maximum: 50 },
    });
    expect(byName.ids).toMatchObject({
      required: false,
      schema: { type: 'string' },
    });
    expect(byName.q).toMatchObject({ required: false });
    expect(byName.specialism).toMatchObject({ required: false });
  });

  it.each([
    ['/accounts', 20, 50],
    ['/patients/authorized', 20, 50],
    ['/patients', 20, 50],
  ])(
    'documents the GET %s pagination defaults and limits',
    async (path, defaultLimit, maxLimit) => {
      const parameters = (await getDocument()).paths[path].get.parameters;
      const byName = Object.fromEntries(
        (parameters ?? []).map((parameter) => [parameter.name, parameter]),
      );

      expect(byName.page).toMatchObject({
        required: false,
        schema: { type: 'integer', default: 1, minimum: 1 },
      });
      expect(byName.limit).toMatchObject({
        required: false,
        schema: {
          type: 'integer',
          default: defaultLimit,
          minimum: 1,
          maximum: maxLimit,
        },
      });
    },
  );

  it('documents the optional GET /accounts search and filters', async () => {
    const parameters = (await getDocument()).paths['/accounts'].get.parameters;
    const byName = Object.fromEntries(
      (parameters ?? []).map((parameter) => [parameter.name, parameter]),
    );

    expect(byName.q).toMatchObject({
      required: false,
      description: expect.stringContaining('e-mail'),
      schema: { type: 'string' },
    });

    expect(byName.isPatient).toMatchObject({
      required: false,
      schema: { type: 'boolean' },
    });
    expect(byName.isProfessional).toMatchObject({
      required: false,
      schema: { type: 'boolean' },
    });
    expect(byName.profile).toMatchObject({
      required: false,
      schema: {
        type: 'array',
        items: { enum: ['none', 'patient', 'professional', 'admin'] },
      },
    });
    expect(byName.status).toMatchObject({
      required: false,
      schema: { enum: ['active', 'inactive'] },
    });
    expect(byName.createdFrom).toMatchObject({ required: false });
    expect(byName.createdTo).toMatchObject({ required: false });
    expect(byName.sort).toMatchObject({
      required: false,
      schema: { enum: ['name', 'createdAt'], default: 'name' },
    });
    expect(byName.order).toMatchObject({
      required: false,
      schema: { enum: ['asc', 'desc'], default: 'asc' },
    });
  });

  it('documents GET /accounts/{id} with the id and the account schema', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/accounts/{id}'].get;

    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', in: 'path', required: true }),
      ]),
    );
    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/GetAccountResponseDto',
    );
    expect(components.schemas.GetAccountResponseDto.required).toEqual(
      expect.arrayContaining([
        'id',
        'fullName',
        'socialName',
        'birthDate',
        'sex',
        'gender',
        'cpf',
        'email',
        'phone',
        'role',
        'status',
        'createdAt',
        'updatedAt',
        'profile',
      ]),
    );
  });

  it('returns the email of each GET /accounts item', async () => {
    const { components } = await getDocument();

    expect(components.schemas.AccountSummaryResponseDto.required).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'socialName',
        'email',
        'cpf',
        'role',
        'profile',
        'specialisms',
        'status',
        'createdAt',
      ]),
    );
  });

  it('documents DELETE of a support contact with 204 and the session', async () => {
    const operation = (await getDocument()).paths[
      '/patients/{patientId}/support-contacts/{contactId}'
    ].delete;

    expect(operation.tags?.length).toBeGreaterThan(0);
    expect(operation.responses).toHaveProperty('204');
    expect(operation.responses).toHaveProperty('401');
  });

  it('lists the three POST /patients conflicts', async () => {
    const conflict = (await getDocument()).paths['/patients'].post.responses[
      '409'
    ];

    expect(
      Object.keys(conflict?.content?.['application/json']?.examples ?? {}),
    ).toEqual([
      'ADMIN_ACCOUNT_NOT_ALLOWED',
      'ACCOUNT_HAS_PROFESSIONAL_PROFILE',
      'PATIENT_PROFILE_ALREADY_EXISTS',
    ]);
  });

  it('documents DELETE /pts/proposals/{id}', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/pts/proposals/{id}'].delete;

    expect(operation.requestBody).toBeUndefined();
    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/DeletePtsProposalResponseDto',
    );
    expect(components.schemas.DeletePtsProposalResponseDto.required).toEqual([
      'status',
    ]);
    expect(
      Object.keys(
        operation.responses['409']?.content?.['application/json']?.examples ??
          {},
      ),
    ).toEqual(['PTS_NOT_DRAFT']);
  });

  it('documents DELETE /pts/{id}/team/{professionalId}', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/pts/{id}/team/{professionalId}'].delete;
    const examples = (status: string) =>
      Object.keys(
        operation.responses[status]?.content?.['application/json']?.examples ??
          {},
      );

    expect(
      (operation.parameters ?? [])
        .filter((parameter) => parameter.in === 'path')
        .map((parameter) => parameter.name),
    ).toEqual(['id', 'professionalId']);
    expect(operation.requestBody).toBeUndefined();
    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/PtsTeamResponseDto',
    );
    expect(components.schemas.PtsTeamResponseDto.required).toEqual([
      'id',
      'status',
      'responsible',
      'team',
    ]);
    expect(examples('404')).toEqual(['PTS_NOT_FOUND', 'TEAM_MEMBER_NOT_FOUND']);
    expect(examples('409')).toEqual([
      'PTS_NOT_ACTIVE',
      'CANNOT_REMOVE_RESPONSIBLE',
    ]);
  });

  it('documents the GOALS_INCOMPLETE of POST /pts/proposals/{id}/approve', async () => {
    const { paths, components } = await getDocument();
    const conflict = paths['/pts/proposals/{id}/approve'].post.responses['409'];

    expect(
      Object.keys(conflict?.content?.['application/json']?.examples ?? {}),
    ).toEqual([
      'PTS_NOT_DRAFT',
      'ACTIVE_PTS_ALREADY_EXISTS',
      'GOALS_INCOMPLETE',
    ]);
    expect(components.schemas.GoalsIncompleteErrorDto.required).toEqual([
      'status',
      'message',
      'pendingGoals',
    ]);
    expect(
      components.schemas.UpdatePtsProposalRequestDto.required,
    ).toBeUndefined();
  });

  it('documents POST /pts/{id}/close', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/pts/{id}/close'].post;

    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/ClosePtsResponseDto',
    );
    expect(components.schemas.ClosePtsRequestDto.required).toEqual([
      'outcome',
      'closingDate',
    ]);
    for (const [status, code] of [
      ['400', 'VALIDATION_ERROR'],
      ['403', 'FORBIDDEN'],
      ['404', 'PTS_NOT_FOUND'],
      ['409', 'PTS_NOT_ACTIVE'],
    ]) {
      expect(
        Object.keys(
          operation.responses[status]?.content?.['application/json']
            ?.examples ?? {},
        ),
      ).toEqual([code]);
    }
  });

  it('documents POST /pts/{id}/reassessment', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/pts/{id}/reassessment'].post;
    const examples = (status: string) =>
      Object.keys(
        operation.responses[status]?.content?.['application/json']?.examples ??
          {},
      );

    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/RegisterReassessmentResponseDto',
    );
    expect(components.schemas.RegisterReassessmentRequestDto.required).toEqual([
      'meetingDate',
      'goals',
      'createNextVersion',
    ]);
    expect(components.schemas.RegisterReassessmentResponseDto.required).toEqual(
      ['id', 'status', 'reassessedAt', 'nextPtsId'],
    );
    expect(examples('400')).toEqual([
      'VALIDATION_ERROR',
      'GOALS_WITHOUT_RESULT',
    ]);
    expect(examples('403')).toEqual(['FORBIDDEN']);
    expect(examples('404')).toEqual(['PTS_NOT_FOUND']);
    expect(examples('409')).toEqual([
      'PTS_NOT_RUNNING',
      'DRAFT_ALREADY_EXISTS',
    ]);
  });

  it('documents POST /pts/{id}/start', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/pts/{id}/start'].post;
    const examples = (status: string) =>
      Object.keys(
        operation.responses[status]?.content?.['application/json']?.examples ??
          {},
      );

    expect(operation.requestBody).toBeUndefined();
    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/PtsStartResponseDto',
    );
    expect(components.schemas.PtsStartResponseDto.required).toEqual([
      'id',
      'status',
      'beganAt',
    ]);
    expect(examples('400')).toEqual(['VALIDATION_ERROR']);
    expect(examples('403')).toEqual(['FORBIDDEN']);
    expect(examples('404')).toEqual(['PTS_NOT_FOUND']);
    expect(examples('409')).toEqual(['PTS_NOT_PLANNING']);
  });

  it('documents the /pts/{id}/activities routes', async () => {
    const { paths, components } = await getDocument();
    const { get, post } = paths['/pts/{id}/activities'];

    expect(responseSchema(get, '200')?.$ref).toBe(
      '#/components/schemas/GetActivitiesResponseDto',
    );
    expect(responseSchema(post, '201')?.$ref).toBe(
      '#/components/schemas/ActivityResponseDto',
    );
    expect(components.schemas.CreateActivityRequestDto.required).toEqual([
      'title',
      'description',
      'type',
      'specialism',
      'frequency',
      'modality',
    ]);
    for (const [status, code] of [
      ['400', 'VALIDATION_ERROR'],
      ['403', 'FORBIDDEN'],
      ['404', 'PTS_NOT_FOUND'],
      ['409', 'PTS_NOT_EDITABLE'],
      ['422', 'INVALID_FREQUENCY'],
    ]) {
      expect(
        Object.keys(
          post.responses[status]?.content?.['application/json']?.examples ?? {},
        ),
      ).toEqual([code]);
    }
  });

  it('documents GET /activities/{id}', async () => {
    const { paths, components } = await getDocument();
    const { get } = paths['/activities/{id}'];

    expect(responseSchema(get, '200')?.$ref).toBe(
      '#/components/schemas/ActivityDetailsResponseDto',
    );
    expect(components.schemas.ActivityDetailsResponseDto.required).toEqual(
      expect.arrayContaining(['goal', 'documents', 'appointmentsCount']),
    );
    expect(
      Object.keys(
        get.responses['404']?.content?.['application/json']?.examples ?? {},
      ),
    ).toEqual(['ACTIVITY_NOT_FOUND', 'PTS_NOT_FOUND']);
  });

  it('documents PATCH /activities/{id}', async () => {
    const { paths } = await getDocument();
    const { patch } = paths['/activities/{id}'];

    expect(responseSchema(patch, '200')?.$ref).toBe(
      '#/components/schemas/ActivityResponseDto',
    );
    for (const [status, codes] of [
      ['400', ['VALIDATION_ERROR']],
      ['403', ['FORBIDDEN']],
      ['404', ['ACTIVITY_NOT_FOUND', 'PTS_NOT_FOUND']],
      ['409', ['ACTIVITY_NOT_EDITABLE', 'PTS_NOT_EDITABLE']],
      ['422', ['INVALID_FREQUENCY']],
    ] as const) {
      expect(
        Object.keys(
          patch.responses[status]?.content?.['application/json']?.examples ??
            {},
        ),
      ).toEqual(codes);
    }
  });

  it.each(['suspend', 'resume', 'conclude'])(
    'documents POST /activities/{id}/%s',
    async (action) => {
      const { paths, components } = await getDocument();
      const { post } = paths[`/activities/{id}/${action}`];
      const examples = (status: string) =>
        Object.keys(
          post.responses[status]?.content?.['application/json']?.examples ?? {},
        );

      expect(responseSchema(post, '200')?.$ref).toBe(
        '#/components/schemas/ActivityStatusResponseDto',
      );
      expect(components.schemas.ActivityStatusResponseDto.required).toEqual([
        'id',
        'status',
        'changedAt',
      ]);
      expect(examples('403')).toEqual(['FORBIDDEN']);
      expect(examples('404')).toEqual(['ACTIVITY_NOT_FOUND', 'PTS_NOT_FOUND']);
      expect(examples('409')).toEqual([
        'INVALID_ACTIVITY_TRANSITION',
        'PTS_NOT_EDITABLE',
      ]);
    },
  );

  it('documents POST /activities/{id}/archive', async () => {
    const { paths, components } = await getDocument();
    const { post } = paths['/activities/{id}/archive'];

    expect(responseSchema(post, '200')?.$ref).toBe(
      '#/components/schemas/ArchiveActivityResponseDto',
    );
    expect(components.schemas.ArchiveActivityResponseDto.required).toEqual([
      'id',
      'status',
      'archivedAt',
    ]);
    for (const [status, codes] of [
      ['403', ['FORBIDDEN']],
      ['404', ['ACTIVITY_NOT_FOUND', 'PTS_NOT_FOUND']],
      ['409', ['ACTIVITY_NOT_ARCHIVABLE', 'PTS_NOT_EDITABLE']],
    ] as const) {
      expect(
        Object.keys(
          post.responses[status]?.content?.['application/json']?.examples ?? {},
        ),
      ).toEqual(codes);
    }
  });

  it('documents the /notifications routes', async () => {
    const { paths, components } = await getDocument();
    const read = paths['/notifications/{id}/read'].post;

    expect(responseSchema(paths['/notifications'].get, '200')?.$ref).toBe(
      '#/components/schemas/GetNotificationsResponseDto',
    );
    expect(components.schemas.GetNotificationsResponseDto.required).toEqual([
      'data',
      'pagination',
      'unreadCount',
    ]);
    expect(components.schemas.NotificationResponseDto.required).toEqual([
      'id',
      'type',
      'message',
      'ptsId',
      'createdAt',
      'readAt',
    ]);
    expect(
      Object.keys(
        read.responses['404']?.content?.['application/json']?.examples ?? {},
      ),
    ).toEqual(['NOTIFICATION_NOT_FOUND']);
  });

  it('documents the /pts/{id}/goals routes', async () => {
    const { paths, components } = await getDocument();
    const list = paths['/pts/{id}/goals'];
    const item = paths['/pts/{id}/goals/{goalId}'];
    const examples = (operation: OpenApiOperation, status: string) =>
      Object.keys(
        operation.responses[status]?.content?.['application/json']?.examples ??
          {},
      );

    expect(responseSchema(list.get, '200')?.$ref).toBe(
      '#/components/schemas/GetGoalsResponseDto',
    );
    expect(responseSchema(list.post, '201')?.$ref).toBe(
      '#/components/schemas/GoalResponseDto',
    );
    expect(responseSchema(item.patch, '200')?.$ref).toBe(
      '#/components/schemas/GoalResponseDto',
    );
    expect(responseSchema(item.delete, '200')?.$ref).toBe(
      '#/components/schemas/DeleteGoalResponseDto',
    );
    expect(components.schemas.CreateGoalRequestDto.required).toEqual([
      'title',
      'description',
      'term',
      'area',
      'measureCriterion',
      'targetDate',
    ]);
    expect(components.schemas.UpdateGoalRequestDto.required).toBeUndefined();
    expect(examples(list.post, '409')).toEqual(['PTS_NOT_EDITABLE']);
    expect(examples(item.patch, '404')).toEqual([
      'PTS_NOT_FOUND',
      'GOAL_NOT_FOUND',
    ]);
    expect(examples(item.delete, '409')).toEqual([
      'PTS_NOT_EDITABLE',
      'LAST_GOAL',
      'GOAL_HAS_ACTIVITIES',
    ]);
  });

  it('documents GET /pts/{id}/timeline', async () => {
    const { paths, components } = await getDocument();
    const operation = paths['/pts/{id}/timeline'].get;
    const parameters = operation.parameters ?? [];
    const byName = Object.fromEntries(
      parameters
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => [parameter.name, parameter]),
    );

    expect(operation.tags).toEqual(['timeline']);
    expect(
      parameters
        .filter((parameter) => parameter.in === 'path')
        .map((parameter) => parameter.name),
    ).toEqual(['id']);
    expect(Object.keys(byName)).toEqual(
      expect.arrayContaining([
        'q',
        'type',
        'authorId',
        'from',
        'to',
        'order',
        'page',
        'limit',
      ]),
    );
    expect(Object.values(byName).every((p) => p.required === false)).toBe(true);
    expect(byName.page).toMatchObject({
      schema: { type: 'integer', default: 1, minimum: 1 },
    });
    expect(byName.limit).toMatchObject({
      schema: { type: 'integer', default: 20, minimum: 1, maximum: 50 },
    });
    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/GetTimelineResponseDto',
    );
    expect(components.schemas.GetTimelineResponseDto.required).toEqual([
      'data',
      'pagination',
    ]);
    expect(components.schemas.TimelineRecordDto.required).toEqual([
      'id',
      'type',
      'targetType',
      'targetId',
      'description',
      'happenedAt',
      'author',
      'assignedTo',
    ]);
  });

  it('reads the POST /patients body from the DTO', async () => {
    const { paths, components } = await getDocument();
    const schema =
      paths['/patients'].post.requestBody?.content['application/json']?.schema;

    expect(schema?.$ref).toBe('#/components/schemas/CreatePatientRequestDto');
    expect(components.schemas.CreatePatientRequestDto.required).toEqual([
      'accountId',
    ]);
    expect(components.schemas.SupportContactDto.required).toEqual(['name']);
  });

  it('reads the POST /professionals body from the DTO', async () => {
    const { paths, components } = await getDocument();
    const schema =
      paths['/professionals'].post.requestBody?.content['application/json']
        ?.schema;

    expect(schema?.$ref).toBe(
      '#/components/schemas/CreateProfessionalRequestDto',
    );
    expect(components.schemas.CreateProfessionalRequestDto.required).toEqual([
      'accountId',
      'specialism',
      'councilNumber',
      'councilState',
    ]);
  });

  it('documents the POST /me/password response with its own DTO', async () => {
    const operation = (await getDocument()).paths['/me/password'].post;

    expect(responseSchema(operation, '200')?.$ref).toBe(
      '#/components/schemas/ChangePasswordResponseDto',
    );
  });

  it('lists the three POST /professionals conflicts', async () => {
    const conflict = (await getDocument()).paths['/professionals'].post
      .responses['409'];

    expect(
      Object.keys(conflict?.content?.['application/json']?.examples ?? {}),
    ).toEqual([
      'ADMIN_ACCOUNT_NOT_ALLOWED',
      'ACCOUNT_HAS_PATIENT_PROFILE',
      'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
    ]);
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
