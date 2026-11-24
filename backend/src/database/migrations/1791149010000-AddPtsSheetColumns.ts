import { MigrationInterface, QueryRunner } from 'typeorm';

// Ficha do PTS (RFPTS005, RN030, RN031): diagnóstico em comum, perfil de
// neurodivergência, vulnerabilidades e próxima revisão. Os valores de partida
// (DEFAULT) mantêm o rascunho funcionando até a ficha entrar na criação da
// proposta; nas linhas existentes, as datas partem de created_at.
export class AddPtsSheetColumns1791149010000 implements MigrationInterface {
  name = 'AddPtsSheetColumns1791149010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        ADD COLUMN "case_study_date" date NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN "diagnosis_summary" text NOT NULL DEFAULT 'A preencher',
        ADD COLUMN "cid" text,
        ADD COLUMN "support_level" smallint,
        ADD COLUMN "strengths" text,
        ADD COLUMN "priority_needs" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "vulnerabilities" text,
        ADD COLUMN "comorbidities" text,
        ADD COLUMN "sensory_profile" text,
        ADD COLUMN "communication_method" text,
        ADD COLUMN "next_review_at" date NOT NULL
          DEFAULT (CURRENT_DATE + INTERVAL '12 months'),
        ADD CONSTRAINT "CHK_pts_support_level"
          CHECK ("support_level" IS NULL OR "support_level" BETWEEN 1 AND 3)
    `);
    await queryRunner.query(`
      UPDATE "projeto_terapeutico_singular"
      SET "case_study_date" = "created_at"::date,
          "next_review_at" = ("created_at" + INTERVAL '12 months')::date
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projeto_terapeutico_singular"
        DROP CONSTRAINT IF EXISTS "CHK_pts_support_level",
        DROP COLUMN IF EXISTS "next_review_at",
        DROP COLUMN IF EXISTS "communication_method",
        DROP COLUMN IF EXISTS "sensory_profile",
        DROP COLUMN IF EXISTS "comorbidities",
        DROP COLUMN IF EXISTS "vulnerabilities",
        DROP COLUMN IF EXISTS "priority_needs",
        DROP COLUMN IF EXISTS "strengths",
        DROP COLUMN IF EXISTS "support_level",
        DROP COLUMN IF EXISTS "cid",
        DROP COLUMN IF EXISTS "diagnosis_summary",
        DROP COLUMN IF EXISTS "case_study_date"
    `);
  }
}
