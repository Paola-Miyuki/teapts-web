import { MigrationInterface, QueryRunner } from 'typeorm';

// Avisos do app (RFNOT001). A restrição única deixa um aviso por destinatário
// e por ciclo; se a data máxima do PTS mudar, sai um aviso novo.
export class CreateNotification1791149060000 implements MigrationInterface {
  name = 'CreateNotification1791149060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "notification_type_e" AS ENUM ('review_window')`,
    );
    await queryRunner.query(`
      CREATE TABLE "notification" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recipient_account_id" uuid NOT NULL,
        "type" "notification_type_e" NOT NULL,
        "pts_id" uuid NOT NULL,
        "message" text NOT NULL,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        "read_at" timestamp(3),
        "review_date" date NOT NULL,
        CONSTRAINT "PK_notification" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_recipient_pts_review"
          UNIQUE ("recipient_account_id", "pts_id", "type", "review_date"),
        CONSTRAINT "FK_notification_recipient_account"
          FOREIGN KEY ("recipient_account_id") REFERENCES "account" ("id"),
        CONSTRAINT "FK_notification_pts" FOREIGN KEY ("pts_id")
          REFERENCES "projeto_terapeutico_singular" ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_recipient" ON "notification" ("recipient_account_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_e"`);
  }
}
