import { MigrationInterface, QueryRunner } from 'typeorm';

// Reavaliação do fim do ciclo (RFEVA005). reassessed_at guarda a data do
// encontro da equipe; o resultado de cada meta já fica em pts_goal.
export class AddPtsReassessmentColumns1791149110000 implements MigrationInterface {
  name = 'AddPtsReassessmentColumns1791149110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        ADD COLUMN "reassessed_at" date,
        ADD COLUMN "reassessed_by_account_id" uuid,
        ADD CONSTRAINT "FK_pts_reassessed_by_account"
          FOREIGN KEY ("reassessed_by_account_id") REFERENCES "account" ("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        DROP CONSTRAINT "FK_pts_reassessed_by_account",
        DROP COLUMN "reassessed_by_account_id",
        DROP COLUMN "reassessed_at"
    `);
  }
}
