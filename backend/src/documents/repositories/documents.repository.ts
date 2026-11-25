// Este arquivo concentra a gravação e a consulta de documentos no banco.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type EntityManager, Repository } from 'typeorm';
import { DocumentEntity } from '../entities/document.entity';

/** Campos que o chamador informa ao criar um documento. */
export type NewDocument = Pick<
  DocumentEntity,
  | 'patientId'
  | 'title'
  | 'category'
  | 'fileKey'
  | 'mimeType'
  | 'sizeBytes'
  | 'uploadedByAccountId'
> &
  Partial<
    Pick<
      DocumentEntity,
      'description' | 'issueDate' | 'issuerAccountId' | 'issuerName'
    >
  >;

@Injectable()
export class DocumentsRepository {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
  ) {}

  /**
   * Grava o documento; campos opcionais ausentes viram `null`. Com `manager`,
   * grava na transação dele.
   */
  create(data: NewDocument, manager?: EntityManager): Promise<DocumentEntity> {
    const documents = manager?.getRepository(DocumentEntity) ?? this.documents;

    return documents.save(
      documents.create({
        description: null,
        issueDate: null,
        issuerAccountId: null,
        issuerName: null,
        ...data,
      }),
    );
  }

  /** Busca pela chave do objeto, que é única (RN014); `null` se não houver. */
  findByFileKey(fileKey: string): Promise<DocumentEntity | null> {
    return this.documents.findOne({ where: { fileKey } });
  }

  /** Busca documento ativo por id, usando a transação quando fornecida. */
  findActiveById(
    id: string,
    manager?: EntityManager,
  ): Promise<DocumentEntity | null> {
    const documents = manager?.getRepository(DocumentEntity) ?? this.documents;

    return documents.findOne({ where: { id, deletedAt: IsNull() } });
  }

  /** Persiste alterações na transação informada. */
  save(
    document: DocumentEntity,
    manager: EntityManager,
  ): Promise<DocumentEntity> {
    return manager.getRepository(DocumentEntity).save(document);
  }
}
