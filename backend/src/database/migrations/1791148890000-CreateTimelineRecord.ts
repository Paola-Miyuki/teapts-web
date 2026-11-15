import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimelineRecord1791148890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE timeline_record_type_e AS ENUM ('removed');`,
    );
    await queryRunner.query(
      `CREATE TYPE timeline_record_target_e AS ENUM ('pts');`,
    );

    await queryRunner.query(`
      CREATE TABLE timeline_record (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type timeline_record_type_e NOT NULL,
        description text NOT NULL,
        "happenedAt" timestamp(3) NOT NULL DEFAULT now(),
        "targetId" uuid NOT NULL,
        "targetType" timeline_record_target_e NOT NULL,
        projeto_terapeutico_singular_id uuid NOT NULL REFERENCES projeto_terapeutico_singular (id),
        author_professional_id uuid REFERENCES professional (id)
      );
    `);

    // A timeline é lida por PTS, em ordem cronológica (RFTL001).
    await queryRunner.query(`
      CREATE INDEX timeline_record_pts_happened_at_idx
        ON timeline_record (projeto_terapeutico_singular_id, "happenedAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS timeline_record;`);
    await queryRunner.query(`DROP TYPE IF EXISTS timeline_record_target_e;`);
    await queryRunner.query(`DROP TYPE IF EXISTS timeline_record_type_e;`);
  }
}
