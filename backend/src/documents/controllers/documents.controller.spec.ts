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
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import type { DeleteDocumentResponseDto } from '../dto/delete-document-response.dto';
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
const deleted: DeleteDocumentResponseDto = {
  id: documentId,
  deletedAt: '2026-12-09T12:00:00.000Z',
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
    remove: jest.Mock<
      (
        account: AccountContext,
        id: string,
      ) => Promise<DeleteDocumentResponseDto>
    >;
  };
  let allowed: boolean;
  let current: AccountContext;

  beforeEach(async () => {
    allowed = true;
    current = account;
    documents = {
      getUrl: jest.fn(async () => url),
      remove: jest.fn(async () => deleted),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        AdminGuard,
        { provide: DocumentsService, useValue: documents },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            current;
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

  describe('DELETE /documents/:id', () => {
    it('answers 200 with the id and deletedAt', async () => {
      const response = await request(app.getHttpServer()).delete(
        `/documents/${documentId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(deleted);
      expect(documents.remove).toHaveBeenCalledWith(account, documentId);
    });

    it('answers 403 FORBIDDEN for a non-admin without calling the service', async () => {
      current = {
        ...account,
        role: AccountRole.User,
        professionalProfileIds: ['professional-1'],
      };

      const response = await request(app.getHttpServer()).delete(
        `/documents/${documentId}`,
      );

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('FORBIDDEN');
      expect(documents.remove).not.toHaveBeenCalled();
    });

    it('answers 403 without calling the service when the session guard blocks', async () => {
      allowed = false;

      const response = await request(app.getHttpServer()).delete(
        `/documents/${documentId}`,
      );

      expect(response.status).toBe(403);
      expect(documents.remove).not.toHaveBeenCalled();
    });

    it('answers 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
      const response = await request(app.getHttpServer()).delete(
        '/documents/123',
      );

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('VALIDATION_ERROR');
    });

    it('forwards 404 DOCUMENT_NOT_FOUND from the service', async () => {
      documents.remove.mockRejectedValueOnce(
        new NotFoundException({ status: 'DOCUMENT_NOT_FOUND' }),
      );

      const response = await request(app.getHttpServer()).delete(
        `/documents/${documentId}`,
      );

      expect(response.status).toBe(404);
    });
  });
});
