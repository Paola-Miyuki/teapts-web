// Este arquivo concentra a gravação e a consulta de documentos no banco.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { escapeLike } from '../../common/search/escape-like';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { DocumentEntity } from '../entities/document.entity';
import type { DocumentCategory } from '../enums/document-category.enum';

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

/** Filtros e paginação da listagem de documentos de um paciente. */
export interface DocumentListFilters {
  q?: string;
  category?: DocumentCategory[];
  page: number;
  limit: number;
}

/** Linha da listagem: o documento com quem enviou e o emissor. */
export interface DocumentListRow {
  id: string;
  title: string;
  category: DocumentCategory;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
  uploader_id: string;
  uploader_name: string;
  uploaded_by_patient: boolean;
  issuer_account_name: string | null;
  issuer_specialism: string | null;
  issuer_institution: string | null;
  issuer_name: string | null;
}

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

  /**
   * Lista os documentos ativos do paciente, do mais recente ao mais antigo.
   *
   * @param patientId paciente dono dos documentos
   * @param filters busca pelo título, categorias e paginação
   * @returns a página de linhas e o total que atende aos filtros
   */
  async findPage(
    patientId: string,
    filters: DocumentListFilters,
  ): Promise<{ rows: DocumentListRow[]; total: number }> {
    const query = this.documents
      .createQueryBuilder('document')
      .innerJoin(
        Account,
        'uploader',
        'uploader.id = document.uploadedByAccountId',
      )
      .innerJoin(Patient, 'patient', 'patient.id = document.patientId')
      .leftJoin(
        Account,
        'issuerAccount',
        'issuerAccount.id = document.issuerAccountId',
      )
      .leftJoin(
        Professional,
        'issuerProfessional',
        'issuerProfessional.accountId = document.issuerAccountId',
      )
      .where('document.patientId = :patientId', { patientId })
      .andWhere('document.deletedAt IS NULL')
      .select([
        'document.id AS id',
        'document.title AS title',
        'document.category AS category',
        'document.mimeType AS mime_type',
        'document.sizeBytes AS size_bytes',
        'document.createdAt AS created_at',
        'uploader.id AS uploader_id',
        'uploader.name AS uploader_name',
        'uploader.id = patient.accountId AS uploaded_by_patient',
        'issuerAccount.name AS issuer_account_name',
        'issuerProfessional.specialism AS issuer_specialism',
        'issuerProfessional.institution AS issuer_institution',
        'document.issuerName AS issuer_name',
      ]);

    if (filters.q !== undefined) {
      query.andWhere(`document.title ILIKE :q ESCAPE '\\'`, {
        q: `%${escapeLike(filters.q)}%`,
      });
    }

    if (filters.category !== undefined) {
      query.andWhere('document.category IN (:...categories)', {
        categories: filters.category,
      });
    }

    query
      .orderBy('document.createdAt', 'DESC')
      .addOrderBy('document.id', 'ASC');

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<DocumentListRow>();

    return { rows, total };
  }
}
