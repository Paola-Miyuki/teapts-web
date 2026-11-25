import { MigrationInterface, QueryRunner } from 'typeorm';

// Versão do PTS e ligação com a anterior (RFPTS013). Os PTS existentes são
// numerados por paciente, na ordem de criação, como o histórico já mostrava.
export class AddPtsVersion1791149100000 implements MigrationInterface {
  name = 'AddPtsVersion1791149100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        ADD COLUMN "version" integer NOT NULL DEFAULT 1,
        ADD COLUMN "previous_pts_id" uuid,
        ADD CONSTRAINT "FK_pts_previous" FOREIGN KEY ("previous_pts_id")
          REFERENCES "projeto_terapeutico_singular" ("id")
    `);
    await queryRunner.query(`
      UPDATE "projeto_terapeutico_singular" pts
      SET "version" = numbered."version"
      FROM (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "patient_id"
          ORDER BY "deleted_at" IS NOT NULL, "created_at", "id"
        ) AS "version"
        FROM "projeto_terapeutico_singular"
      ) numbered
      WHERE numbered."id" = pts."id"
    `);
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        ADD CONSTRAINT "UQ_pts_patient_version" UNIQUE ("patient_id", "version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        DROP CONSTRAINT "UQ_pts_patient_version",
        DROP CONSTRAINT "FK_pts_previous",
        DROP COLUMN "previous_pts_id",
        DROP COLUMN "version"
    `);
  }
}
