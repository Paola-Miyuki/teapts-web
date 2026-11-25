import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { DocumentEntity } from '../entities/document.entity';
import { DocumentCategory } from '../enums/document-category.enum';
import { DocumentsRepository, type NewDocument } from './documents.repository';

const newDocument: NewDocument = {
  patientId: 'patient-1',
  title: 'Laudo neurológico',
  category: DocumentCategory.MEDICAL_REPORT,
  fileKey: 'patient-1/a1b2-laudo.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  uploadedByAccountId: 'account-1',
};

function createBuilder(rows: unknown[] = [], total = 0) {
  const builder: Record<string, jest.Mock> = {};

  for (const method of [
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'select',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
  ]) {
    builder[method] = jest.fn(() => builder);
  }

  builder.clone = jest.fn(() => ({ getCount: () => Promise.resolve(total) }));
  builder.getRawMany = jest.fn(() => Promise.resolve(rows));

  return builder;
}

let builder = createBuilder();

function createRepository() {
  const typeormRepository = {
    create: jest.fn((data: Partial<DocumentEntity>) => data),
    save: jest.fn((data: Partial<DocumentEntity>) =>
      Promise.resolve({ id: 'doc-1', ...data }),
    ),
    findOne: jest.fn<() => Promise<DocumentEntity | null>>(),
    createQueryBuilder: jest.fn(() => builder),
  };
  const repository = new DocumentsRepository(
    typeormRepository as unknown as Repository<DocumentEntity>,
  );

  return { repository, typeormRepository };
}

describe('DocumentsRepository', () => {
  it('saves the document with the optional fields as null', async () => {
    const { repository, typeormRepository } = createRepository();

    const saved = await repository.create(newDocument);

    expect(typeormRepository.create).toHaveBeenCalledWith({
      description: null,
      issueDate: null,
      issuerAccountId: null,
      issuerName: null,
      ...newDocument,
    });
    expect(saved).toMatchObject({ id: 'doc-1', fileKey: newDocument.fileKey });
  });

  it('keeps the optional fields that were informed', async () => {
    const { repository, typeormRepository } = createRepository();

    await repository.create({
      ...newDocument,
      issueDate: '2026-11-20',
      issuerName: 'Dra. Marta Reis',
      description: 'Laudo de 2026',
    });

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        issueDate: '2026-11-20',
        issuerName: 'Dra. Marta Reis',
        issuerAccountId: null,
        description: 'Laudo de 2026',
      }),
    );
  });

  it('finds a document by its file key', async () => {
    const { repository, typeormRepository } = createRepository();
    const found = { id: 'doc-1' } as DocumentEntity;
    typeormRepository.findOne.mockResolvedValue(found);

    await expect(repository.findByFileKey('k')).resolves.toBe(found);
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { fileKey: 'k' },
    });
  });

  it('returns null when no document has the file key', async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.findOne.mockResolvedValue(null);

    await expect(repository.findByFileKey('k')).resolves.toBeNull();
  });

  describe('findPage', () => {
    it('filters by the patient and leaves the deleted ones out, newest first', async () => {
      builder = createBuilder([{ id: 'doc-1' }], 1);
      const { repository } = createRepository();

      await expect(
        repository.findPage('patient-1', { page: 1, limit: 20 }),
      ).resolves.toEqual({ rows: [{ id: 'doc-1' }], total: 1 });

      expect(builder.where).toHaveBeenCalledWith(
        'document.patientId = :patientId',
        { patientId: 'patient-1' },
      );
      expect(builder.andWhere).toHaveBeenCalledWith(
        'document.deletedAt IS NULL',
      );
      expect(builder.andWhere).toHaveBeenCalledTimes(1);
      expect(builder.orderBy).toHaveBeenCalledWith(
        'document.createdAt',
        'DESC',
      );
      expect(builder.offset).toHaveBeenCalledWith(0);
      expect(builder.limit).toHaveBeenCalledWith(20);
    });

    it('searches the title escaping %, _ and \\ and filters by category', async () => {
      builder = createBuilder();
      const { repository } = createRepository();

      await repository.findPage('patient-1', {
        q: '50%_\\',
        category: [DocumentCategory.TCLE, DocumentCategory.IMAGE_AUTHORIZATION],
        page: 3,
        limit: 10,
      });

      expect(builder.andWhere).toHaveBeenCalledWith(
        `document.title ILIKE :q ESCAPE '\\'`,
        { q: '%50\\%\\_\\\\%' },
      );
      expect(builder.andWhere).toHaveBeenCalledWith(
        'document.category IN (:...categories)',
        { categories: ['tcle', 'image_authorization'] },
      );
      expect(builder.offset).toHaveBeenCalledWith(20);
      expect(builder.limit).toHaveBeenCalledWith(10);
    });
  });
});
