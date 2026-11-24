import { MigrationInterface, QueryRunner } from 'typeorm';

// Registro no conselho, instituição e CNES do perfil profissional (RFPRO002).
// Ficam anuláveis porque os perfis que já existem não têm esses dados; a
// obrigatoriedade do registro entra com o cadastro do perfil.
export class AddProfessionalCouncilFields1791148960000 implements MigrationInterface {
  name = 'AddProfessionalCouncilFields1791148960000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "uf_e" AS ENUM ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional" ADD "council_number" text, ADD "council_state" "uf_e", ADD "institution" text, ADD "cnes" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "professional" DROP COLUMN "cnes", DROP COLUMN "institution", DROP COLUMN "council_state", DROP COLUMN "council_number"`,
    );
    await queryRunner.query(`DROP TYPE "uf_e"`);
  }
}
