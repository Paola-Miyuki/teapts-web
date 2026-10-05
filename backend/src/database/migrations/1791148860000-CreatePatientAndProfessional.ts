import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientAndProfessional1791148860000 implements MigrationInterface {
  name = 'CreatePatientAndProfessional1791148860000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "patient" (
        "accountId" uuid NOT NULL,
        "supportContacts" jsonb[] NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_patient" PRIMARY KEY ("accountId"),
        CONSTRAINT "FK_patient_account" FOREIGN KEY ("accountId")
          REFERENCES "account" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE TYPE "specialism_e" AS ENUM ('psychologist', 'doctor', 'physiotherapist')`,
    );
    await queryRunner.query(`
      CREATE TABLE "professional" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "specialism" "specialism_e" NOT NULL,
        "accountId" uuid NOT NULL,
        CONSTRAINT "PK_professional" PRIMARY KEY ("id"),
        CONSTRAINT "FK_professional_account" FOREIGN KEY ("accountId")
          REFERENCES "account" ("id") ON DELETE CASCADE
      )
    `);
    // O Postgres nao indexa FKs sozinho; o login busca perfis por conta.
    await queryRunner.query(
      `CREATE INDEX "IDX_professional_account_id" ON "professional" ("accountId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "professional"`);
    await queryRunner.query(`DROP TYPE "specialism_e"`);
    await queryRunner.query(`DROP TABLE "patient"`);
  }
}
