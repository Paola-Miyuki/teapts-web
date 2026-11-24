import { MigrationInterface, QueryRunner } from 'typeorm';

// Contatos de suporte saem do `jsonb[]` do paciente para uma tabela, para serem
// mantidos contato a contato (decisoes-aprovadas §17). Os contatos que já
// existem são copiados na ordem em que estavam.
export class CreateSupportContact1791148930000 implements MigrationInterface {
  name = 'CreateSupportContact1791148930000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_contact" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "email" text,
        "phone" text,
        "is_emergency" boolean NOT NULL DEFAULT false,
        "created_at" timestamp(3) NOT NULL DEFAULT now(),
        "updated_at" timestamp(3),
        CONSTRAINT "PK_support_contact" PRIMARY KEY ("id"),
        CONSTRAINT "FK_support_contact_patient" FOREIGN KEY ("patient_id")
          REFERENCES "patient" ("account_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_support_contact_patient_id" ON "support_contact" ("patient_id")`,
    );
    // created_at crescente por posição para manter a ordem da lista antiga.
    await queryRunner.query(`
      INSERT INTO "support_contact" ("patient_id", "name", "description", "email", "phone", "created_at")
      SELECT p."account_id",
             contact.value->>'name',
             NULLIF(contact.value->>'description', ''),
             NULLIF(contact.value->>'email', ''),
             NULLIF(contact.value->>'phone', ''),
             now() + contact.position * interval '1 millisecond'
      FROM "patient" p
      CROSS JOIN LATERAL unnest(p."supportContacts") WITH ORDINALITY AS contact(value, position)
    `);
    await queryRunner.query(
      `ALTER TABLE "patient" DROP COLUMN "supportContacts"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient" ADD "supportContacts" jsonb[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`
      UPDATE "patient" p
      SET "supportContacts" = contacts.list
      FROM (
        SELECT "patient_id",
               array_agg(
                 jsonb_strip_nulls(jsonb_build_object(
                   'name', "name", 'description', "description",
                   'email', "email", 'phone', "phone"
                 ))
                 ORDER BY "created_at", "id"
               ) AS list
        FROM "support_contact"
        GROUP BY "patient_id"
      ) contacts
      WHERE contacts."patient_id" = p."account_id"
    `);
    await queryRunner.query(`DROP TABLE "support_contact"`);
  }
}
