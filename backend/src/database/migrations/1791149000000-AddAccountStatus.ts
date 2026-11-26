import { MigrationInterface, QueryRunner } from 'typeorm';

// Exclusão lógica da conta (RFAUT005, RN021): a conta fica inativa, sem apagar
// perfis nem dados. Os perfis de paciente e de profissional seguem a situação
// da conta. A FK `FK_patient_account` já é `ON DELETE RESTRICT`
// (AlignPatientAndProfessionalConstraints), então não muda aqui.
export class AddAccountStatus1791149000000 implements MigrationInterface {
  name = 'AddAccountStatus1791149000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "account_status_e" AS ENUM ('active', 'inactive')`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "status" "account_status_e" NOT NULL DEFAULT 'active', ADD "deactivated_at" timestamp(3), ADD "deactivated_by_account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_account_deactivated_by" FOREIGN KEY ("deactivated_by_account_id") REFERENCES "account" ("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_account_deactivated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN "deactivated_by_account_id", DROP COLUMN "deactivated_at", DROP COLUMN "status"`,
    );
    await queryRunner.query(`DROP TYPE "account_status_e"`);
  }
}
