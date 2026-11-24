import { MigrationInterface, QueryRunner } from 'typeorm';

// Exclusão lógica da proposta de PTS (RFPTS008, RN021).
export class AddDeletedAtToPts1791148970000 implements MigrationInterface {
  name = 'AddDeletedAtToPts1791148970000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projeto_terapeutico_singular" ADD COLUMN "deleted_at" timestamp(3)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projeto_terapeutico_singular" DROP COLUMN IF EXISTS "deleted_at"`,
    );
  }
}
