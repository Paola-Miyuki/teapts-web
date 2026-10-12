import { MigrationInterface, QueryRunner } from 'typeorm';

// A senha passa a ser do SuperTokens: a conta troca `password_hash` pelo
// vinculo com o usuario do SuperTokens (RFAUT001). Falha se ja houver contas,
// pois nao ha como preencher o vinculo delas.
export class LinkAccountToSupertokens1791148800000 implements MigrationInterface {
  name = 'LinkAccountToSupertokens1791148800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN "password_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "supertokens_user_id" text NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "UQ_account_supertokens_user_id" UNIQUE ("supertokens_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "UQ_account_supertokens_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN "supertokens_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "password_hash" text NOT NULL`,
    );
  }
}
