import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Objeto do storage simulado no Postgres. `active` é `false` enquanto o
// arquivo só foi enviado; a confirmação do documento (RFDOC002) o ativa.
@Entity('stored_object')
export class StoredObject {
  @PrimaryColumn('text', {
    name: 'file_key',
    primaryKeyConstraintName: 'PK_stored_object',
  })
  fileKey!: string;

  @Column('text', { name: 'mime_type' })
  mimeType!: string;

  @Column('integer', { name: 'size_bytes' })
  sizeBytes!: number;

  @Column('bytea')
  content!: Buffer;

  @Column('boolean', { default: false })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;
}
