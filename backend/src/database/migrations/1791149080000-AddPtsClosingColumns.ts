import { MigrationInterface, QueryRunner } from 'typeorm';

// Encerramento do PTS (RFPTS010). concluded_at e cancelled_at guardam quando
// foi registrado; closing_date, a data informada no modal.
export class AddPtsClosingColumns1791149080000 implements MigrationInterface {
  name = 'AddPtsClosingColumns1791149080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        ADD COLUMN "closed_by_account_id" uuid,
        ADD COLUMN "closing_date" date,
        ADD COLUMN "closing_reason" text,
        ADD CONSTRAINT "FK_pts_closed_by_account"
          FOREIGN KEY ("closed_by_account_id") REFERENCES "account" ("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        DROP CONSTRAINT "FK_pts_closed_by_account",
        DROP COLUMN "closing_reason",
        DROP COLUMN "closing_date",
        DROP COLUMN "closed_by_account_id"
    `);
  }
}
