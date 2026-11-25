/*
 * Este teste cobre a consulta do paciente aos documentos que ele enviou
 * (RFDOC007) pelo HTTP: `GET /me/documents` e `GET /documents/:id/url` com a
 * regra do paciente.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createApp,
  documentRow,
  otherPatientId,
  patientAccountId,
  patientId,
  pathOf,
  signIn,
  signOut,
} from './support/documents-read-app';

const ownId = '22222222-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const teamId = '11111111-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const deletedId = '33333333-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const otherPatientDocId = '44444444-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

describe('documents consultation by the patient (e2e)', () => {
  let app: INestApplication;
  let findPage: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
  const documents = [
    documentRow(ownId, { uploadedByAccountId: patientAccountId }),
    documentRow(teamId),
    documentRow(deletedId, {
      uploadedByAccountId: patientAccountId,
      deletedAt: new Date(),
    }),
    documentRow(otherPatientDocId, {
      patientId: otherPatientId,
      uploadedByAccountId: patientAccountId,
    }),
  ];
  const objects = new Map(
    documents.map((d) => [
      d.fileKey,
      {
        fileKey: d.fileKey,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        content: Buffer.from('%PDF-conteudo'),
      },
    ]),
  );

  const signInAsPatient = () =>
    signIn({
      accountId: patientAccountId,
      role: 'user',
      patientProfileId: patientId,
    });

  beforeEach(async () => {
    findPage = jest.fn(async () => ({ rows: [], total: 0 }));
    app = await createApp({
      documents,
      objects,
      findPatient: async () => null,
      findPage,
    });
  });

  afterEach(async () => {
    signOut();
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  describe('GET /me/documents', () => {
    it('lists only what the patient account sent, for their own patient, with the filters', async () => {
      signInAsPatient();

      const response = await server().get(
        '/me/documents?q=%20laudo%20&category=school_report&page=2&limit=5',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      });
      expect(findPage).toHaveBeenCalledWith(
        patientId,
        expect.objectContaining({
          uploadedByAccountId: patientAccountId,
          q: 'laudo',
          category: ['school_report'],
          page: 2,
          limit: 5,
        }),
      );
    });

    it('answers 403 to the admin and to a professional, 401 without session and 400 for a bad parameter', async () => {
      signIn({ role: 'admin' });
      expect((await server().get('/me/documents')).status).toBe(403);

      signIn({ role: 'user', professionalProfileIds: ['pro-1'] });
      expect((await server().get('/me/documents')).status).toBe(403);
      expect(findPage).not.toHaveBeenCalled();

      signOut();
      expect((await server().get('/me/documents')).status).toBe(401);

      signInAsPatient();

      const bad = await server().get('/me/documents?limit=51');

      expect(bad.status).toBe(400);
      expect(bad.body.message).toBe('Parâmetro inválido: limit');
    });
  });

  describe('GET /documents/:id/url', () => {
    it('gives the patient a URL for a document they sent, and the URL serves the file', async () => {
      signInAsPatient();

      const response = await server().get(`/documents/${ownId}/url`);

      expect(response.status).toBe(200);

      const file = await server().get(pathOf(response.body.url));

      expect(file.status).toBe(200);
      expect(file.body.toString()).toBe('%PDF-conteudo');
    });

    it('denies a document from the team, from another account or from another patient', async () => {
      signInAsPatient();

      for (const id of [teamId, otherPatientDocId]) {
        const response = await server().get(`/documents/${id}/url`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          status: 'FORBIDDEN',
          message: 'Você só acessa os documentos que enviou.',
        });
      }
    });

    it('answers 404 for a deleted document the patient had sent', async () => {
      signInAsPatient();

      const response = await server().get(`/documents/${deletedId}/url`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('DOCUMENT_NOT_FOUND');
    });

    it('keeps the team access: the admin still gets the URL of any document', async () => {
      signIn({ role: 'admin' });

      expect((await server().get(`/documents/${teamId}/url`)).status).toBe(200);
    });
  });
});
