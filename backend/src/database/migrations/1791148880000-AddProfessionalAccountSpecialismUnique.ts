import { MigrationInterface, QueryRunner } from 'typeorm';

// Uma conta tem no maximo um perfil por especialidade (RN002). A restricao
// garante isso tambem em cadastros simultaneos.
export class AddProfessionalAccountSpecialismUnique1791148880000 implements MigrationInterface {
  name = 'AddProfessionalAccountSpecialismUnique1791148880000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "professional" ADD CONSTRAINT "UQ_professional_account_specialism" UNIQUE ("accountId", "specialism")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "professional" DROP CONSTRAINT "UQ_professional_account_specialism"`,
    );
  }
}
