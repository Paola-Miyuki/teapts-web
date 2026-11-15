import { MigrationInterface, QueryRunner } from 'typeorm';

// Exclusão lógica da proposta de PTS (RFPTS008, RN021).
export class AddDeletedAtToPts1791148900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE projeto_terapeutico_singular ADD COLUMN "deletedAt" timestamp(3);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE projeto_terapeutico_singular DROP COLUMN IF EXISTS "deletedAt";`,
    );
  }
}
