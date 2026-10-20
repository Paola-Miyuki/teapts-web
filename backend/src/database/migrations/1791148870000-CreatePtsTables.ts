import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePtsTables1791148870000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criação do ENUM para os estados do PTS
    await queryRunner.query(`
      CREATE TYPE pts_state_e AS ENUM ('draft', 'planning', 'running', 'concluded', 'cancelled', 'rejected');
    `);

    await queryRunner.query(`
      CREATE TABLE projeto_terapeutico_singular (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "socialSituation" text NOT NULL,
        status pts_state_e NOT NULL,
        "createdAt" timestamp(3) NOT NULL DEFAULT now(),
        "acceptedAt" timestamp(3),
        "rejectedAt" timestamp(3),
        "beganAt" timestamp(3),
        "concludedAt" timestamp(3),
        "cancelledAt" timestamp(3),
        patient_id uuid NOT NULL REFERENCES patient ("accountId"),
        responsible_professional_id uuid NOT NULL REFERENCES professional (id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE professional_participating_on_therapeutic_journey (
        professional_id uuid NOT NULL REFERENCES professional (id),
        therapeutic_journey_id uuid NOT NULL REFERENCES projeto_terapeutico_singular (id),
        PRIMARY KEY (professional_id, therapeutic_journey_id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS professional_participating_on_therapeutic_journey;`);
    await queryRunner.query(`DROP TABLE IF EXISTS projeto_terapeutico_singular;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pts_state_e;`);
  }
}