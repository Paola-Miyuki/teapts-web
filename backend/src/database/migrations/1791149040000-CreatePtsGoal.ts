import { MigrationInterface, QueryRunner } from 'typeorm';

// Metas terapêuticas do PTS (RFPTS012), com os nomes do propriedades-back.md.
// term e target_date ficam em branco na meta copiada para a nova versão (RFPTS013).
export class CreatePtsGoal1791149040000 implements MigrationInterface {
  name = 'CreatePtsGoal1791149040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "goal_term_e" AS ENUM ('short', 'medium', 'long')`,
    );
    await queryRunner.query(
      `CREATE TYPE "goal_area_e" AS ENUM ('communication', 'social', 'cognitive', 'motor_sensory')`,
    );
    await queryRunner.query(
      `CREATE TYPE "goal_status_e" AS ENUM ('in_progress', 'achieved', 'partially_achieved', 'not_achieved')`,
    );
    await queryRunner.query(
      `CREATE TYPE "goal_origin_e" AS ENUM ('new', 'kept_partial', 'kept_not_achieved')`,
    );
    await queryRunner.query(`
      CREATE TABLE "pts_goal" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pts_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "term" "goal_term_e",
        "area" "goal_area_e" NOT NULL,
        "measure_criterion" text NOT NULL,
        "target_date" date,
        "status" "goal_status_e" NOT NULL DEFAULT 'in_progress',
        "result_note" text,
        "result_recorded_at" timestamp(3),
        "result_recorded_by_account_id" uuid,
        "origin" "goal_origin_e" NOT NULL DEFAULT 'new',
        "previous_goal_id" uuid,
        "author_professional_id" uuid,
        "registered_by_account_id" uuid NOT NULL,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        "updated_at" timestamp(3),
        "deleted_at" timestamp(3),
        CONSTRAINT "PK_pts_goal" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pts_goal_pts" FOREIGN KEY ("pts_id")
          REFERENCES "projeto_terapeutico_singular" ("id"),
        CONSTRAINT "FK_pts_goal_result_recorded_by"
          FOREIGN KEY ("result_recorded_by_account_id") REFERENCES "account" ("id"),
        CONSTRAINT "FK_pts_goal_previous_goal" FOREIGN KEY ("previous_goal_id")
          REFERENCES "pts_goal" ("id"),
        CONSTRAINT "FK_pts_goal_author_professional"
          FOREIGN KEY ("author_professional_id") REFERENCES "professional" ("id"),
        CONSTRAINT "FK_pts_goal_registered_by"
          FOREIGN KEY ("registered_by_account_id") REFERENCES "account" ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_goal_pts_id" ON "pts_goal" ("pts_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pts_goal"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "goal_origin_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "goal_status_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "goal_area_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "goal_term_e"`);
  }
}
