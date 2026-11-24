import { MigrationInterface, QueryRunner } from 'typeorm';

// Cadastro do perfil profissional (RFPRO002): lista fixa de 20 especialidades,
// UF do registro em minúsculas (como o propriedades-back.md) e os campos de
// criação. Registro, instituição e CNES já existem; ficam anuláveis porque os
// perfis antigos não têm registro, e a obrigatoriedade fica no cadastro (RN026).
const SPECIALISMS = [
  'family_doctor',
  'pediatrician',
  'neuropediatrician',
  'neurologist',
  'child_psychiatrist',
  'geneticist',
  'nurse',
  'nursing_technician',
  'neuropsychologist',
  'social_worker',
  'nutritionist',
  'occupational_therapist',
  'pharmacist',
  'speech_therapist',
  'dentist',
  'pediatric_dentist',
  'physical_education_professional',
];

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export class AddProfessionalRegistrationFields1791149020000 implements MigrationInterface {
  name = 'AddProfessionalRegistrationFields1791149020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const specialism of SPECIALISMS) {
      await queryRunner.query(
        `ALTER TYPE "specialism_e" ADD VALUE IF NOT EXISTS '${specialism}'`,
      );
    }

    for (const uf of UFS) {
      await queryRunner.query(
        `ALTER TYPE "uf_e" RENAME VALUE '${uf}' TO '${uf.toLowerCase()}'`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "professional"
        ADD COLUMN "created_at" timestamp(3) NOT NULL DEFAULT now(),
        ADD COLUMN "created_by_account_id" uuid,
        ADD COLUMN "updated_at" timestamp(3),
        ADD CONSTRAINT "FK_professional_created_by_account"
          FOREIGN KEY ("created_by_account_id") REFERENCES "account" ("id"),
        ADD CONSTRAINT "CHK_professional_cnes"
          CHECK ("cnes" IS NULL OR "cnes" ~ '^[0-9]{7}$')
    `);
  }

  // O Postgres não remove valor de enum: as especialidades novas ficam.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "professional"
        DROP CONSTRAINT "CHK_professional_cnes",
        DROP CONSTRAINT "FK_professional_created_by_account",
        DROP COLUMN "updated_at",
        DROP COLUMN "created_by_account_id",
        DROP COLUMN "created_at"
    `);

    for (const uf of UFS) {
      await queryRunner.query(
        `ALTER TYPE "uf_e" RENAME VALUE '${uf.toLowerCase()}' TO '${uf}'`,
      );
    }
  }
}
