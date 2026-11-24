import { MigrationInterface, QueryRunner } from 'typeorm';

// Campos que a lista e a busca de pacientes usam (RFPAC002, RFPAC006).
// Ficam anulaveis porque as contas e os pacientes que ja existem nao tem esses
// dados; a obrigatoriedade e validada no cadastro (RFAUT001, RFPAC001).
export class AddPatientListFields1791148910000 implements MigrationInterface {
  name = 'AddPatientListFields1791148910000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" ADD "social_name" text, ADD "cpf" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "UQ_account_cpf" UNIQUE ("cpf")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient" ADD "cns" text, ADD "guardian_name" text, ADD "registered_at" timestamp(3) NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient" ADD CONSTRAINT "UQ_patient_cns" UNIQUE ("cns")`,
    );
    // Pacientes que ja existem: a data de cadastro vem da criacao da conta.
    await queryRunner.query(
      `UPDATE "patient" SET "registered_at" = "account"."createdAt" FROM "account" WHERE "account"."id" = "patient"."accountId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient" DROP CONSTRAINT "UQ_patient_cns"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient" DROP COLUMN "registered_at", DROP COLUMN "guardian_name", DROP COLUMN "cns"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "UQ_account_cpf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN "cpf", DROP COLUMN "social_name"`,
    );
  }
}
