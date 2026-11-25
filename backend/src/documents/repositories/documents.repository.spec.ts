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

function createRepository() {
  const typeormRepository = {
    create: jest.fn((data: Partial<DocumentEntity>) => data),
    save: jest.fn((data: Partial<DocumentEntity>) =>
      Promise.resolve({ id: 'doc-1', ...data }),
    ),
    findOne: jest.fn<() => Promise<DocumentEntity | null>>(),
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
});
