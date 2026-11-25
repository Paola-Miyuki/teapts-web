import { MigrationInterface, QueryRunner } from 'typeorm';

// Atendimentos da atividade (RFACT004). As colunas de retificação já ficam
// prontas para a RFACT007 (RN020).
export class CreateAppointment1791149120000 implements MigrationInterface {
  name = 'CreateAppointment1791149120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "attendance_e" AS ENUM ('done', 'missed', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "appointment" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "activity_id" uuid NOT NULL,
        "author_professional_id" uuid,
        "registered_by_account_id" uuid NOT NULL,
        "appointment_date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time,
        "modality" "modality_e" NOT NULL,
        "visit_place" "visit_place_e",
        "attendance" "attendance_e" NOT NULL,
        "soap_subjective" text,
        "soap_objective" text,
        "soap_assessment" text,
        "soap_plan" text,
        "absence_reason" text,
        "rectifies_appointment_id" uuid,
        "rectification_reason" text,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appointment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_appointment_activity" FOREIGN KEY ("activity_id")
          REFERENCES "activity" ("id"),
        CONSTRAINT "FK_appointment_author_professional"
          FOREIGN KEY ("author_professional_id") REFERENCES "professional" ("id"),
        CONSTRAINT "FK_appointment_registered_by"
          FOREIGN KEY ("registered_by_account_id") REFERENCES "account" ("id"),
        CONSTRAINT "FK_appointment_rectifies"
          FOREIGN KEY ("rectifies_appointment_id") REFERENCES "appointment" ("id"),
        CONSTRAINT "CHK_appointment_soap" CHECK (
          "attendance" <> 'done' OR (
            "end_time" IS NOT NULL AND "soap_subjective" IS NOT NULL
            AND "soap_objective" IS NOT NULL AND "soap_assessment" IS NOT NULL
            AND "soap_plan" IS NOT NULL
          )
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_appointment_activity_id" ON "appointment" ("activity_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "attendance_e"`);
  }
}
