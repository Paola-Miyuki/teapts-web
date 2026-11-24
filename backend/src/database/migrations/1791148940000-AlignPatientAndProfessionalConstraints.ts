import { MigrationInterface, QueryRunner } from 'typeorm';

// Restrições e índices do propriedades-back.md:
// - um perfil profissional por conta (RN002), no lugar de um por especialidade;
// - a conta do paciente não é apagada em cascata: a exclusão é lógica (RN021);
// - índices das consultas de pacientes e de PTS (NF de p95 até 500 ms).
// O `up` falha se alguma conta já tiver mais de um perfil profissional; nesse
// caso, os perfis a mais precisam sair antes.
export class AlignPatientAndProfessionalConstraints1791148940000 implements MigrationInterface {
  name = 'AlignPatientAndProfessionalConstraints1791148940000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "professional" DROP CONSTRAINT "UQ_professional_account_specialism"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional" ADD CONSTRAINT "UQ_professional_account" UNIQUE ("account_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient" DROP CONSTRAINT "FK_patient_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient" ADD CONSTRAINT "FK_patient_account" FOREIGN KEY ("account_id") REFERENCES "account" ("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_patient_id" ON "projeto_terapeutico_singular" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_responsible_professional_id" ON "projeto_terapeutico_singular" ("responsible_professional_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_status" ON "projeto_terapeutico_singular" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_pts_status"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_responsible_professional_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_patient_id"`);
    await queryRunner.query(
      `ALTER TABLE "patient" DROP CONSTRAINT "FK_patient_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient" ADD CONSTRAINT "FK_patient_account" FOREIGN KEY ("account_id") REFERENCES "account" ("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional" DROP CONSTRAINT "UQ_professional_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional" ADD CONSTRAINT "UQ_professional_account_specialism" UNIQUE ("account_id", "specialism")`,
    );
  }
}
