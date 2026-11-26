import { MigrationInterface, QueryRunner } from 'typeorm';

// Dados pessoais do cadastro (RFAUT001). Ficam anulaveis porque a conta de
// administrador e as contas que ja existem nao tem esses dados; o cadastro
// exige data de nascimento e sexo. A foto (`photo_file_key`) entra com o
// armazenamento de arquivos.
export class AddAccountPersonalFields1791148950000 implements MigrationInterface {
  name = 'AddAccountPersonalFields1791148950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "sex_e" AS ENUM ('male', 'female')`);
    await queryRunner.query(
      `CREATE TYPE "gender_e" AS ENUM ('cis_woman', 'trans_woman', 'cis_man', 'trans_man', 'non_binary', 'other', 'prefer_not_to_say')`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "birth_date" date, ADD "sex" "sex_e", ADD "gender" "gender_e", ADD "phone" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN "phone", DROP COLUMN "gender", DROP COLUMN "sex", DROP COLUMN "birth_date"`,
    );
    await queryRunner.query(`DROP TYPE "gender_e"`);
    await queryRunner.query(`DROP TYPE "sex_e"`);
  }
}
