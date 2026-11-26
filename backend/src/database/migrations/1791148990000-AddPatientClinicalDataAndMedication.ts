import { MigrationInterface, QueryRunner } from 'typeorm';

// Dados clínicos e medicações do paciente (RFPAC007).
export class AddPatientClinicalDataAndMedication1791148990000 implements MigrationInterface {
  name = 'AddPatientClinicalDataAndMedication1791148990000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient"
        ADD COLUMN IF NOT EXISTS "allergies" text,
        ADD COLUMN IF NOT EXISTS "no_known_allergies" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "clinical_history" text,
        ADD COLUMN IF NOT EXISTS "surgical_history" text,
        ADD COLUMN IF NOT EXISTS "family_history" text,
        ADD COLUMN IF NOT EXISTS "habits" text,
        ADD COLUMN IF NOT EXISTS "developmental_milestones" text,
        ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3),
        ADD COLUMN IF NOT EXISTS "updated_by_account_id" uuid REFERENCES "account" ("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "patient"
        ADD CONSTRAINT "CHK_patient_allergies"
        CHECK (NOT "no_known_allergies" OR "allergies" IS NULL)
    `);

    await queryRunner.query(`
      CREATE TABLE "medication" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL,
        "drug_name" text NOT NULL,
        "dose" text NOT NULL,
        "frequency" text NOT NULL,
        "prescriber" text,
        "reason" text,
        "start_date" date NOT NULL,
        "end_date" date,
        "registered_by_account_id" uuid NOT NULL,
        "stopped_by_account_id" uuid,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        "updated_at" timestamp(3),
        CONSTRAINT "PK_medication" PRIMARY KEY ("id"),
        CONSTRAINT "FK_medication_patient"
          FOREIGN KEY ("patient_id")
          REFERENCES "patient" ("account_id"),
        CONSTRAINT "FK_medication_registered_by"
          FOREIGN KEY ("registered_by_account_id")
          REFERENCES "account" ("id"),
        FOREIGN KEY ("stopped_by_account_id")
          REFERENCES "account" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_medication_patient_id" ON "medication" ("patient_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "medication"`);

    await queryRunner.query(
      `ALTER TABLE "patient" DROP CONSTRAINT "CHK_patient_allergies"`,
    );

    await queryRunner.query(`
      ALTER TABLE "patient"
        DROP COLUMN "updated_by_account_id",
        DROP COLUMN "updated_at",
        DROP COLUMN "developmental_milestones",
        DROP COLUMN "habits",
        DROP COLUMN "family_history",
        DROP COLUMN "surgical_history",
        DROP COLUMN "clinical_history",
        DROP COLUMN "no_known_allergies",
        DROP COLUMN "allergies"
    `);
  }
}
