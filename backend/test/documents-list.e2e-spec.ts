/*
 * Este teste cobre a consulta dos documentos pela equipe (RFDOC003) pelo
 * HTTP: `GET /patients/:id/documents`, `GET /documents/:id/url` e
 * `GET /storage/objects/:fileKey` com o token de leitura.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createApp,
  documentRow,
  otherPatientId,
  patientId,
  pathOf,
  signIn,
  signOut,
} from './support/documents-read-app';

const docId = '11111111-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const deletedId = '33333333-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const otherPatientDocId = '44444444-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

describe('documents consultation by the team (e2e)', () => {
  let app: INestApplication;
  let linked: boolean;
  let findPage: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
  const objects = new Map<string, Record<string, unknown>>();
  const documents = [
    documentRow(docId),
    documentRow(deletedId, { deletedAt: new Date() }),
    documentRow(otherPatientDocId, { patientId: otherPatientId }),
  ];

  beforeEach(async () => {
    linked = true;
    objects.clear();
    objects.set(documents[0].fileKey, {
      fileKey: documents[0].fileKey,
      mimeType: 'application/pdf',
      sizeBytes: 13,
      content: Buffer.from('%PDF-conteudo'),
    });
    findPage = jest.fn(async () => ({ rows: [], total: 0 }));
    app = await createApp({
      documents,
      objects,
      findPatient: async () => (linked ? { read_only: false } : null),
      findPage,
    });
  });

  afterEach(async () => {
    signOut();
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('lets the admin and a linked professional list with the filters', async () => {
    signIn({ role: 'admin' });

    const admin = await server().get(
      `/patients/${patientId}/documents?q=%20laudo%20&category=tcle,exam&page=2&limit=10`,
    );

    expect(admin.status).toBe(200);
    expect(admin.body).toEqual({
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    });
    expect(findPage).toHaveBeenCalledWith(
      patientId,
      expect.objectContaining({
        q: 'laudo',
        category: ['tcle', 'exam'],
        page: 2,
        limit: 10,
      }),
    );

    signIn({ role: 'user', professionalProfileIds: ['pro-1'] });

    const professional = await server().get(`/patients/${patientId}/documents`);

    expect(professional.status).toBe(200);
  });

  it('answers 403 to a professional without a link and does not search', async () => {
    linked = false;
    signIn({ role: 'user', professionalProfileIds: ['pro-1'] });

    const response = await server().get(
      `/patients/${patientId}/documents?q=laudo`,
    );

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('FORBIDDEN');
    expect(findPage).not.toHaveBeenCalled();
  });

  it('answers 403 to the patient, even for the own id', async () => {
    signIn({ role: 'user', patientProfileId: patientId });

    const response = await server().get(`/patients/${patientId}/documents`);

    expect(response.status).toBe(403);
    expect(findPage).not.toHaveBeenCalled();
  });

  it('answers 401 without a session, 404 for an unknown patient and 400 for a bad parameter', async () => {
    expect(
      (await server().get(`/patients/${patientId}/documents`)).status,
    ).toBe(401);

    signIn({ role: 'admin' });

    const unknown = await server().get(
      '/patients/9f9f9f9f-1d2b-4b43-8a6e-0f2b6c1d9e33/documents',
    );

    expect(unknown.status).toBe(404);
    expect(unknown.body.status).toBe('PATIENT_NOT_FOUND');

    const bad = await server().get(`/patients/${patientId}/documents?page=0`);

    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: page',
    });
  });

  describe('GET /documents/:id/url', () => {
    it('gives the admin and a linked professional a read URL that serves the file', async () => {
      signIn({ role: 'user', professionalProfileIds: ['pro-1'] });

      const response = await server().get(`/documents/${docId}/url`);

      expect(response.status).toBe(200);
      expect(Date.parse(response.body.expiresAt)).toBeGreaterThan(Date.now());

      const file = await server().get(pathOf(response.body.url));

      expect(file.status).toBe(200);
      expect(file.headers['content-type']).toContain('application/pdf');
      expect(file.headers['content-disposition']).toContain('inline');
      expect(file.body.toString()).toBe('%PDF-conteudo');

      const download = await server().get(
        `${pathOf(response.body.url)}&download=1`,
      );

      expect(download.headers['content-disposition']).toContain('attachment');
    });

    it('answers 403 without a link and for the patient', async () => {
      linked = false;
      signIn({ role: 'user', professionalProfileIds: ['pro-1'] });

      expect((await server().get(`/documents/${docId}/url`)).status).toBe(403);

      signIn({ role: 'user', patientProfileId: patientId });

      expect((await server().get(`/documents/${docId}/url`)).status).toBe(403);
    });

    it('answers 404 DOCUMENT_NOT_FOUND for a deleted or unknown document and 401 without session', async () => {
      expect((await server().get(`/documents/${docId}/url`)).status).toBe(401);

      signIn({ role: 'admin' });

      for (const id of [deletedId, '99999999-0a9f-4e8d-9c7b-6a5f4e3d2c1b']) {
        const response = await server().get(`/documents/${id}/url`);

        expect(response.status).toBe(404);
        expect(response.body.status).toBe('DOCUMENT_NOT_FOUND');
      }
    });

    it('refuses a professional linked to another patient', async () => {
      linked = false;
      signIn({ role: 'user', professionalProfileIds: ['pro-1'] });

      expect(
        (await server().get(`/documents/${otherPatientDocId}/url`)).status,
      ).toBe(403);
    });
  });

  describe('GET /storage/objects/:fileKey', () => {
    const key = () => encodeURIComponent(documents[0].fileKey);

    it('refuses a missing, forged, write or other-object token', async () => {
      signIn({ role: 'admin' });
      const { body } = await server().get(`/documents/${docId}/url`);
      const token = new URL(body.url).searchParams.get('token');
      const otherKey = encodeURIComponent(`${patientId}/other.pdf`);

      for (const path of [
        `/storage/objects/${key()}`,
        `/storage/objects/${key()}?token=abc.def`,
        `/storage/objects/${otherKey}?token=${token}`,
      ]) {
        const response = await server().get(path);

        expect(response.status).toBe(403);
        expect(response.body.status).toBe('READ_URL_INVALID');
      }
    });

    it('does not accept the upload (write) URL for reading', async () => {
      signIn({ role: 'admin' });
      const created = await server()
        .post(`/patients/${patientId}/documents/upload-url`)
        .send({
          fileName: 'novo.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 13,
        });
      const writeToken = new URL(created.body.uploadUrl).searchParams.get(
        'token',
      );

      const response = await server().get(
        `/storage/objects/${encodeURIComponent(created.body.fileKey)}?token=${writeToken}`,
      );

      expect(response.status).toBe(403);
    });

    it('answers 404 FILE_NOT_FOUND when the object is gone', async () => {
      signIn({ role: 'admin' });
      const { body } = await server().get(`/documents/${docId}/url`);
      objects.clear();

      const response = await server().get(pathOf(body.url));

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('FILE_NOT_FOUND');
    });
  });
});
