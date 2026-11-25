import { jest } from '@jest/globals';
import {
  type ExecutionContext,
  ForbiddenException,
  type INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import type { DocumentUrlResponseDto } from '../dto/document-url-response.dto';
import { DocumentsService } from '../services/documents.service';
import { DocumentsController } from './documents.controller';

const documentId = '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const account: AccountContext = {
  accountId: 'admin-1',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};
const url: DocumentUrlResponseDto = {
  url: 'http://localhost:3000/storage/objects/k?token=t',
  expiresAt: '2026-12-01T12:05:00.000Z',
};

describe('DocumentsController', () => {
  let app: INestApplication;
  let documents: {
    getUrl: jest.Mock<
      (account: AccountContext, id: string) => Promise<DocumentUrlResponseDto>
    >;
  };
  let allowed: boolean;

  beforeEach(async () => {
    allowed = true;
    documents = { getUrl: jest.fn(async () => url) };

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
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

  it('answers 200 with the read url', async () => {
    const response = await request(app.getHttpServer()).get(
      `/documents/${documentId}/url`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(url);
    expect(documents.getUrl).toHaveBeenCalledWith(account, documentId);
  });

  it('answers 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
    const response = await request(app.getHttpServer()).get(
      '/documents/123/url',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it('forwards 404 DOCUMENT_NOT_FOUND and 403 FORBIDDEN from the service', async () => {
    documents.getUrl.mockRejectedValueOnce(
      new NotFoundException({ status: 'DOCUMENT_NOT_FOUND' }),
    );
    documents.getUrl.mockRejectedValueOnce(
      new ForbiddenException({ status: 'FORBIDDEN' }),
    );

    const notFound = await request(app.getHttpServer()).get(
      `/documents/${documentId}/url`,
    );
    const forbidden = await request(app.getHttpServer()).get(
      `/documents/${documentId}/url`,
    );

    expect(notFound.status).toBe(404);
    expect(forbidden.status).toBe(403);
  });

  it('does not call the service when the guard blocks the request', async () => {
    allowed = false;

    const response = await request(app.getHttpServer()).get(
      `/documents/${documentId}/url`,
    );

    expect(response.status).toBe(403);
    expect(documents.getUrl).not.toHaveBeenCalled();
  });
});
