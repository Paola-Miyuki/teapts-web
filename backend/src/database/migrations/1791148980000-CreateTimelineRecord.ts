import { MigrationInterface, QueryRunner } from 'typeorm';

// Histórico do PTS (RFTL001), com os nomes do propriedades-back.md. Os valores
// dos enums são os eventos que as telas mostram.
export class CreateTimelineRecord1791148980000 implements MigrationInterface {
  name = 'CreateTimelineRecord1791148980000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "timeline_record_type_e" AS ENUM (
        'pts_created', 'pts_updated', 'pts_approved', 'pts_rejected',
        'pts_started', 'pts_concluded', 'pts_cancelled', 'pts_reassessed',
        'next_version_created',
        'goal_added', 'goal_updated', 'goal_removed',
        'member_added', 'member_removed', 'responsibility_transferred',
        'activity_suggested', 'activity_approved', 'activity_rejected',
        'activity_updated', 'activity_suspended', 'activity_resumed',
        'activity_concluded', 'activity_archived', 'activity_goal_unlinked',
        'appointment_registered', 'appointment_rectified',
        'document_uploaded', 'document_updated', 'document_replaced',
        'document_deleted'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "timeline_record_target_e" AS ENUM (
        'pts', 'activity', 'appointment', 'team_member', 'document'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "timeline_record" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pts_id" uuid NOT NULL,
        "type" "timeline_record_type_e" NOT NULL,
        "description" text NOT NULL,
        "happened_at" timestamp(3) NOT NULL DEFAULT now(),
        "target_id" uuid NOT NULL,
        "target_type" "timeline_record_target_e" NOT NULL,
        "author_professional_id" uuid,
        "executed_by_account_id" uuid NOT NULL,
        CONSTRAINT "PK_timeline_record" PRIMARY KEY ("id"),
        CONSTRAINT "FK_timeline_record_pts" FOREIGN KEY ("pts_id")
          REFERENCES "projeto_terapeutico_singular" ("id"),
        CONSTRAINT "FK_timeline_record_author_professional"
          FOREIGN KEY ("author_professional_id") REFERENCES "professional" ("id"),
        CONSTRAINT "FK_timeline_record_executed_by"
          FOREIGN KEY ("executed_by_account_id") REFERENCES "account" ("id")
      )
    `);
    // A timeline é lida por PTS, em ordem cronológica (RFTL001).
    await queryRunner.query(
      `CREATE INDEX "IDX_timeline_record_pts_happened_at" ON "timeline_record" ("pts_id", "happened_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "timeline_record"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "timeline_record_target_e"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "timeline_record_type_e"`);
  }
}
