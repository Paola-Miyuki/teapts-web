import { MigrationInterface, QueryRunner } from 'typeorm';

// Storage simulado no Postgres (decisoes-aprovadas.md §20): o arquivo enviado
// fica em `content` até virar documento. `active` só vira `true` na
// confirmação do documento (RFDOC002); objeto não ativo é lixo a limpar
// (RFDOC004). Tabela nova, fora do propriedades-back.md.
export class CreateStoredObject1791149030000 implements MigrationInterface {
  name = 'CreateStoredObject1791149030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stored_object" (
        "file_key" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" integer NOT NULL,
        "content" bytea NOT NULL,
        "active" boolean NOT NULL DEFAULT false,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stored_object" PRIMARY KEY ("file_key"),
        CONSTRAINT "CHK_stored_object_size"
          CHECK ("size_bytes" BETWEEN 1 AND 5242880)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stored_object"`);
  }
}
