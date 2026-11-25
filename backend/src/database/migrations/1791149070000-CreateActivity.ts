import { MigrationInterface, QueryRunner } from 'typeorm';

// Atividades do PTS (RFACT001), com os nomes do propriedades-back.md. O
// specialism_e já tem a lista completa (AddProfessionalRegistrationFields).
export class CreateActivity1791149070000 implements MigrationInterface {
  name = 'CreateActivity1791149070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "activity_type_e" AS ENUM ('individual_session', 'group_session', 'parental_guidance', 'school_support', 'team_meeting', 'home_activity', 'consultation', 'referral', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "activity_state_e" AS ENUM ('suggested', 'running', 'suspended', 'concluded', 'rejected', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "executor_e" AS ENUM ('team', 'family', 'school')`,
    );
    await queryRunner.query(
      `CREATE TYPE "modality_e" AS ENUM ('in_person', 'telehealth', 'external_visit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "visit_place_e" AS ENUM ('home', 'school', 'other')`,
    );
    await queryRunner.query(`
      CREATE TABLE "activity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pts_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "type" "activity_type_e" NOT NULL,
        "specialism" "specialism_e" NOT NULL,
        "frequency" jsonb NOT NULL,
        "modality" "modality_e" NOT NULL,
        "visit_place" "visit_place_e",
        "planned_start_date" date,
        "planned_end_date" date,
        "executor" "executor_e" NOT NULL DEFAULT 'team',
        "goal_id" uuid,
        "status" "activity_state_e" NOT NULL DEFAULT 'suggested',
        "status_reason" text,
        "status_changed_by_account_id" uuid,
        "author_professional_id" uuid,
        "registered_by_account_id" uuid NOT NULL,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        "updated_at" timestamp(3),
        "approved_at" timestamp(3),
        "rejected_at" timestamp(3),
        "suspended_at" timestamp(3),
        "concluded_at" timestamp(3),
        "archived_at" timestamp(3),
        CONSTRAINT "PK_activity" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_pts" FOREIGN KEY ("pts_id")
          REFERENCES "projeto_terapeutico_singular" ("id"),
        CONSTRAINT "FK_activity_goal" FOREIGN KEY ("goal_id")
          REFERENCES "pts_goal" ("id"),
        CONSTRAINT "FK_activity_status_changed_by"
          FOREIGN KEY ("status_changed_by_account_id") REFERENCES "account" ("id"),
        CONSTRAINT "FK_activity_author_professional"
          FOREIGN KEY ("author_professional_id") REFERENCES "professional" ("id"),
        CONSTRAINT "FK_activity_registered_by"
          FOREIGN KEY ("registered_by_account_id") REFERENCES "account" ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_pts_id" ON "activity" ("pts_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "activity_executor" (
        "activity_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        CONSTRAINT "PK_activity_executor"
          PRIMARY KEY ("activity_id", "professional_id"),
        CONSTRAINT "FK_activity_executor_activity" FOREIGN KEY ("activity_id")
          REFERENCES "activity" ("id"),
        CONSTRAINT "FK_activity_executor_professional"
          FOREIGN KEY ("professional_id") REFERENCES "professional" ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "activity_document" (
        "activity_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "linked_at" timestamp(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_document"
          PRIMARY KEY ("activity_id", "document_id"),
        CONSTRAINT "FK_activity_document_activity" FOREIGN KEY ("activity_id")
          REFERENCES "activity" ("id"),
        CONSTRAINT "FK_activity_document_document" FOREIGN KEY ("document_id")
          REFERENCES "document" ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_document"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_executor"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "visit_place_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "modality_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "executor_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "activity_state_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "activity_type_e"`);
  }
}
