import { jest } from '@jest/globals';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
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

describe('POST /patients/:id/documents/upload-url', () => {
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
  let allowed: boolean;

  beforeEach(async () => {
    allowed = true;
    uploads = { createUploadUrl: jest.fn(async () => created) };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientDocumentsController],
      providers: [{ provide: DocumentUploadService, useValue: uploads }],
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
});
