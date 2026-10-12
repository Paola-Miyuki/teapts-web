import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccount1791072000000 implements MigrationInterface {
  name = 'CreateAccount1791072000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "account_role_e" AS ENUM ('admin', 'user')`,
    );
    await queryRunner.query(`
      CREATE TABLE "account" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "last_updated_at" timestamp(3),
        "createdAt" timestamp(3) NOT NULL DEFAULT now(),
        "role" "account_role_e" NOT NULL DEFAULT 'user',
        CONSTRAINT "PK_account" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_email" UNIQUE ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "account"`);
    await queryRunner.query(`DROP TYPE "account_role_e"`);
  }
}
