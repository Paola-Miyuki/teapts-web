import { MigrationInterface, QueryRunner } from 'typeorm';

// Documentos do paciente (RFDOC002), com os nomes do propriedades-back.md.
// `file_key` é única (RN014) e liga o documento ao objeto do storage; o
// emissor é uma conta ou um texto, nunca os dois.
export class CreateDocument1791149050000 implements MigrationInterface {
  name = 'CreateDocument1791149050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "document_category_e" AS ENUM (
        'medical_report', 'exam', 'prescription', 'therapy_report',
        'school_report', 'pei', 'discharge_report', 'tcle',
        'image_authorization', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "document" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "category" "document_category_e" NOT NULL,
        "issue_date" date,
        "issuer_account_id" uuid,
        "issuer_name" text,
        "file_key" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" integer NOT NULL,
        "uploaded_by_account_id" uuid NOT NULL,
        "replaces_document_id" uuid,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        "updated_at" timestamp(3),
        "updated_by_account_id" uuid,
        "deleted_at" timestamp(3),
        "deleted_by_account_id" uuid,
        CONSTRAINT "PK_document" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_file_key" UNIQUE ("file_key"),
        CONSTRAINT "CHK_document_issuer"
          CHECK ("issuer_account_id" IS NULL OR "issuer_name" IS NULL),
        CONSTRAINT "FK_document_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patient" ("account_id"),
        CONSTRAINT "FK_document_issuer_account" FOREIGN KEY ("issuer_account_id")
          REFERENCES "account" ("id"),
        CONSTRAINT "FK_document_uploaded_by" FOREIGN KEY ("uploaded_by_account_id")
          REFERENCES "account" ("id"),
        CONSTRAINT "FK_document_replaces" FOREIGN KEY ("replaces_document_id")
          REFERENCES "document" ("id"),
        CONSTRAINT "FK_document_updated_by" FOREIGN KEY ("updated_by_account_id")
          REFERENCES "account" ("id"),
        CONSTRAINT "FK_document_deleted_by" FOREIGN KEY ("deleted_by_account_id")
          REFERENCES "account" ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_document_patient_id" ON "document" ("patient_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "document"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_category_e"`);
  }
}
