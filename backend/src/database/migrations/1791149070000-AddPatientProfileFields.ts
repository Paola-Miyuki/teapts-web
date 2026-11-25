import { MigrationInterface, QueryRunner } from 'typeorm';

// Dados do cadastro do paciente (propriedades-back.md, 3.2): endereço,
// filiação, telefone do responsável tutelar, escolaridade, instituição de
// ensino e unidade de referência. As colunas ficam anuláveis porque os
// pacientes que já existem não as têm (como o `cns`); a obrigatoriedade vale
// no cadastro.
export class AddPatientProfileFields1791149070000 implements MigrationInterface {
  name = 'AddPatientProfileFields1791149070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "education_level_e" AS ENUM (
        'early_childhood_daycare', 'early_childhood_preschool',
        'elementary_incomplete', 'elementary_ongoing', 'elementary_complete',
        'high_school_incomplete', 'high_school_ongoing', 'high_school_complete',
        'technical_incomplete', 'technical_ongoing', 'technical_complete',
        'undergraduate_incomplete', 'undergraduate_ongoing',
        'undergraduate_complete', 'postgraduate_specialization',
        'postgraduate_mba', 'postgraduate_masters', 'postgraduate_doctorate'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "patient"
        ADD COLUMN "address_zip_code" text,
        ADD COLUMN "address_street" text,
        ADD COLUMN "address_number" text,
        ADD COLUMN "address_complement" text,
        ADD COLUMN "address_district" text,
        ADD COLUMN "address_city" text,
        ADD COLUMN "address_state" "uf_e",
        ADD COLUMN "filiation_1" text,
        ADD COLUMN "filiation_2" text,
        ADD COLUMN "guardian_phone" text,
        ADD COLUMN "education_level" "education_level_e",
        ADD COLUMN "school_name" text,
        ADD COLUMN "reference_unit" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient"
        DROP COLUMN "reference_unit",
        DROP COLUMN "school_name",
        DROP COLUMN "education_level",
        DROP COLUMN "guardian_phone",
        DROP COLUMN "filiation_2",
        DROP COLUMN "filiation_1",
        DROP COLUMN "address_state",
        DROP COLUMN "address_city",
        DROP COLUMN "address_district",
        DROP COLUMN "address_complement",
        DROP COLUMN "address_number",
        DROP COLUMN "address_street",
        DROP COLUMN "address_zip_code"
    `);
    await queryRunner.query(`DROP TYPE "education_level_e"`);
  }
}
