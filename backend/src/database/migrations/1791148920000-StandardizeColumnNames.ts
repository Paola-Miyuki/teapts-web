import { MigrationInterface, QueryRunner } from 'typeorm';

// Padroniza em snake_case as colunas criadas em camelCase (decisoes-aprovadas
// §19), sem perda de dados. As entidades apontam para os nomes novos com `name:`.
const RENAMES: [table: string, from: string, to: string][] = [
  ['account', 'createdAt', 'created_at'],
  ['account', 'last_updated_at', 'updated_at'],
  ['patient', 'accountId', 'account_id'],
  ['professional', 'accountId', 'account_id'],
  ['projeto_terapeutico_singular', 'socialSituation', 'social_situation'],
  ['projeto_terapeutico_singular', 'createdAt', 'created_at'],
  ['projeto_terapeutico_singular', 'acceptedAt', 'accepted_at'],
  ['projeto_terapeutico_singular', 'rejectedAt', 'rejected_at'],
  ['projeto_terapeutico_singular', 'beganAt', 'began_at'],
  ['projeto_terapeutico_singular', 'concludedAt', 'concluded_at'],
  ['projeto_terapeutico_singular', 'cancelledAt', 'cancelled_at'],
];

export class StandardizeColumnNames1791148920000 implements MigrationInterface {
  name = 'StandardizeColumnNames1791148920000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of RENAMES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of [...RENAMES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${to}" TO "${from}"`,
      );
    }
  }
}
