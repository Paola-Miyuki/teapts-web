import { jest } from '@jest/globals';
import {
  type ExecutionContext,
  ForbiddenException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import type { DocumentListResponseDto } from '../dto/document-list-response.dto';
import { DocumentsService } from '../services/documents.service';
import { MyDocumentsController } from './my-documents.controller';

const account: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11',
  professionalProfileIds: [],
};
const page: DocumentListResponseDto = {
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('MyDocumentsController', () => {
  let app: INestApplication;
  let documents: {
    listMine: jest.Mock<
      (
        account: AccountContext,
        query: unknown,
      ) => Promise<DocumentListResponseDto>
    >;
  };
  let allowed: boolean;

  beforeEach(async () => {
    allowed = true;
    documents = { listMine: jest.fn(async () => page) };

    const moduleRef = await Test.createTestingModule({
      controllers: [MyDocumentsController],
      providers: [{ provide: DocumentsService, useValue: documents }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            account;
          return allowed;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 200 with the page and passes the normalized query', async () => {
    const response = await request(app.getHttpServer()).get(
      '/me/documents?q=%20laudo%20&category=school_report&page=2&limit=10',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(page);
    expect(documents.listMine).toHaveBeenCalledWith(
      account,
      expect.objectContaining({
        q: 'laudo',
        category: ['school_report'],
        page: 2,
        limit: 10,
      }),
    );
  });

  it('answers 400 ERROR for an invalid parameter', async () => {
    const response = await request(app.getHttpServer()).get(
      '/me/documents?page=0',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: page',
    });
    expect(documents.listMine).not.toHaveBeenCalled();
  });

  it('forwards 403 FORBIDDEN from the service', async () => {
    documents.listMine.mockRejectedValue(
      new ForbiddenException({ status: 'FORBIDDEN' }),
    );

    const response = await request(app.getHttpServer()).get('/me/documents');

    expect(response.status).toBe(403);
  });

  it('does not call the service when the guard blocks the request', async () => {
    allowed = false;

    const response = await request(app.getHttpServer()).get('/me/documents');

    expect(response.status).toBe(403);
    expect(documents.listMine).not.toHaveBeenCalled();
  });
});
