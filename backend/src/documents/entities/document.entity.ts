import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentCategory } from '../enums/document-category.enum';

// Documento do paciente (RFDOC002). As chaves estrangeiras e as restrições
// (`UQ_document_file_key`, `CHK_document_issuer`) ficam na migration.
@Entity('document')
@Index('IDX_document_patient_id', ['patientId'])
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_document' })
  id!: string;

  @Column('uuid', { name: 'patient_id' })
  patientId!: string;

  @Column('text')
  title!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: DocumentCategory,
    enumName: 'document_category_e',
  })
  category!: DocumentCategory;

  /** Data de emissão, no formato `YYYY-MM-DD`. */
  @Column('date', { name: 'issue_date', nullable: true })
  issueDate!: string | null;

  @Column('uuid', { name: 'issuer_account_id', nullable: true })
  issuerAccountId!: string | null;

  @Column('text', { name: 'issuer_name', nullable: true })
  issuerName!: string | null;

  @Column('text', { name: 'file_key', unique: true })
  fileKey!: string;

  @Column('text', { name: 'mime_type' })
  mimeType!: string;

  @Column('integer', { name: 'size_bytes' })
  sizeBytes!: number;

  @Column('uuid', { name: 'uploaded_by_account_id' })
  uploadedByAccountId!: string;

  @Column('uuid', { name: 'replaces_document_id', nullable: true })
  replacesDocumentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @Column('timestamp', {
    name: 'updated_at',
    precision: 3,
    nullable: true,
  })
  updatedAt!: Date | null;

  @Column('uuid', { name: 'updated_by_account_id', nullable: true })
  updatedByAccountId!: string | null;

  @Column('timestamp', {
    name: 'deleted_at',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;

  @Column('uuid', { name: 'deleted_by_account_id', nullable: true })
  deletedByAccountId!: string | null;
}
