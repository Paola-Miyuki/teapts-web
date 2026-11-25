import { jest } from '@jest/globals';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import type { DocumentResponseDto } from '../dto/document-response.dto';
import { DocumentsService } from '../services/documents.service';
import type { DocumentListResponseDto } from '../dto/document-list-response.dto';
import type { CreateUploadUrlResponseDto } from '../dto/create-upload-url-response.dto';
import { DocumentUploadService } from '../services/document-upload.service';
import { PatientDocumentsController } from './patient-documents.controller';

const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
const account: AccountContext = {
  accountId: 'admin-1',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};
const body = {
  fileName: 'laudo.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 820000,
};
const created: CreateUploadUrlResponseDto = {
  uploadUrl: 'http://localhost:3000/storage/objects/k?token=t',
  fileKey: `${patientId}/abc-laudo.pdf`,
  expiresAt: '2026-12-01T12:15:00.000Z',
};

const confirmBody = {
  fileKey: `${patientId}/abc-laudo.pdf`,
  title: 'Laudo neurológico',
  category: 'medical_report',
  issueDate: '2026-11-20',
  issuerName: 'Dra. Marta Reis',
};
const confirmed: DocumentResponseDto = {
  id: '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b',
  title: 'Laudo neurológico',
  category: 'medical_report' as DocumentResponseDto['category'],
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  createdAt: '2026-12-01T12:00:00.000Z',
};

const page: DocumentListResponseDto = {
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('PatientDocumentsController', () => {
  let app: INestApplication;
  let uploads: {
    createUploadUrl: jest.Mock<
      (
        account: AccountContext,
        patientId: string,
        input: unknown,
      ) => Promise<CreateUploadUrlResponseDto>
    >;
  };
  let documents: {
    confirm: jest.Mock<
      (
        account: AccountContext,
        patientId: string,
        input: unknown,
      ) => Promise<DocumentResponseDto>
    >;
    list: typeof list;
  };
  let list: jest.Mock<
    (
      account: AccountContext,
      patientId: string,
      query: unknown,
    ) => Promise<DocumentListResponseDto>
  >;
  let allowed: boolean;

  beforeEach(async () => {
    allowed = true;
    uploads = { createUploadUrl: jest.fn(async () => created) };
    list = jest.fn(async () => page);
    documents = { confirm: jest.fn(async () => confirmed), list };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientDocumentsController],
      providers: [
        { provide: DocumentUploadService, useValue: uploads },
        { provide: DocumentsService, useValue: documents },
      ],
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

  it('answers 201 with the url, key and expiry', async () => {
    const response = await request(app.getHttpServer())
      .post(`/patients/${patientId}/documents/upload-url`)
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(created);
    expect(uploads.createUploadUrl).toHaveBeenCalledWith(
      account,
      patientId,
      body,
    );
  });

  it('answers 400 FILE_TYPE_NOT_ALLOWED for a type outside the list', async () => {
    const response = await request(app.getHttpServer())
      .post(`/patients/${patientId}/documents/upload-url`)
      .send({ ...body, mimeType: 'text/html' });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('FILE_TYPE_NOT_ALLOWED');
    expect(uploads.createUploadUrl).not.toHaveBeenCalled();
  });

  it('answers 400 FILE_TOO_LARGE above 5 MB', async () => {
    const response = await request(app.getHttpServer())
      .post(`/patients/${patientId}/documents/upload-url`)
      .send({ ...body, sizeBytes: 5_242_881 });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('FILE_TOO_LARGE');
  });

  it('answers 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients/123/documents/upload-url')
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it('does not call the service when the guard blocks the request', async () => {
    allowed = false;

    const response = await request(app.getHttpServer())
      .post(`/patients/${patientId}/documents/upload-url`)
      .send(body);

    expect(response.status).toBe(403);
    expect(uploads.createUploadUrl).not.toHaveBeenCalled();
  });

  describe('POST /patients/:id/documents', () => {
    it('answers 201 with the confirmed document', async () => {
      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/documents`)
        .send(confirmBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(confirmed);
      expect(documents.confirm).toHaveBeenCalledWith(
        account,
        patientId,
        confirmBody,
      );
    });

    it('answers 400 VALIDATION_ERROR without a title', async () => {
      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/documents`)
        .send({ ...confirmBody, title: '' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'VALIDATION_ERROR',
        message: 'Informe o título.',
      });
      expect(documents.confirm).not.toHaveBeenCalled();
    });

    it('answers 400 VALIDATION_ERROR with both issuers', async () => {
      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/documents`)
        .send({
          ...confirmBody,
          issuerAccountId: '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('VALIDATION_ERROR');
      expect(documents.confirm).not.toHaveBeenCalled();
    });

    it('answers 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
      const response = await request(app.getHttpServer())
        .post('/patients/123/documents')
        .send(confirmBody);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'VALIDATION_ERROR',
        message: 'Parâmetro inválido: id',
      });
    });

    it('does not call the service when the guard blocks the request', async () => {
      allowed = false;

      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/documents`)
        .send(confirmBody);

      expect(response.status).toBe(403);
      expect(documents.confirm).not.toHaveBeenCalled();
    });
  });

  describe('GET /patients/:id/documents', () => {
    it('answers 200 with the page and passes the normalized query', async () => {
      const response = await request(app.getHttpServer()).get(
        `/patients/${patientId}/documents?q=%20laudo%20&category=tcle,exam&page=2&limit=10`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(page);
      expect(list).toHaveBeenCalledWith(
        account,
        patientId,
        expect.objectContaining({
          q: 'laudo',
          category: ['tcle', 'exam'],
          page: 2,
          limit: 10,
        }),
      );
    });

    it('answers 400 ERROR for an invalid parameter', async () => {
      const response = await request(app.getHttpServer()).get(
        `/patients/${patientId}/documents?limit=51`,
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'ERROR',
        message: 'Parâmetro inválido: limit',
      });
      expect(list).not.toHaveBeenCalled();
    });

    it('answers 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
      const response = await request(app.getHttpServer()).get(
        '/patients/123/documents',
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'VALIDATION_ERROR',
        message: 'Parâmetro inválido: id',
      });
    });

    it('does not call the service when the guard blocks the request', async () => {
      allowed = false;

      const response = await request(app.getHttpServer()).get(
        `/patients/${patientId}/documents`,
      );

      expect(response.status).toBe(403);
      expect(list).not.toHaveBeenCalled();
    });
  });
});
