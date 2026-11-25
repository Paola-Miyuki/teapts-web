import { jest } from '@jest/globals';
import type { DataSource, EntityManager } from 'typeorm';

import { NotificationsRepository } from './notifications.repository';

const notice = {
  ptsId: 'pts-1',
  reviewDate: '2026-12-03',
  message: 'A reavaliação do PTS de Lívia vence em 30 dias (03/12/2026).',
};

function setup(results: unknown[][]) {
  const query = jest.fn<
    (sql: string, params?: unknown[]) => Promise<unknown[]>
  >(async () => results.shift() ?? []);
  const transaction = jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
    run({ query } as unknown as EntityManager),
  );

  return {
    query,
    transaction,
    repository: new NotificationsRepository({
      query,
      transaction,
    } as unknown as DataSource),
  };
}

describe('NotificationsRepository', () => {
  it('busca PTS ativo na janela, sem aviso do mesmo ciclo', async () => {
    const rows = [
      { ptsId: 'pts-1', reviewDate: '2026-12-03', patientName: 'Lívia' },
    ];
    const { repository, query } = setup([rows]);

    expect(
      await repository.findPtsInReviewWindow('2026-11-03', '2026-12-03'),
    ).toEqual(rows);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("IN ('planning', 'running')");
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('NOT EXISTS');
    expect(params).toEqual(['2026-11-03', '2026-12-03']);
  });

  it('trava o PTS e insere sem repetir, só para conta ativa que não é admin', async () => {
    const { repository, query, transaction } = setup([
      [{ id: 'pts-1' }],
      [],
      [{ id: 'n1' }, { id: 'n2' }],
    ]);

    expect(await repository.createReviewWindowNotices(notice)).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);

    const [lock, , insert] = query.mock.calls;
    expect(lock[0]).toContain('FOR UPDATE');
    expect(insert[0]).toContain('ON CONFLICT');
    expect(insert[0]).toContain("role <> 'admin'");
    expect(insert[0]).toContain("status = 'active'");
    expect(insert[1]).toEqual(['pts-1', '2026-12-03', notice.message]);
  });

  it.each([
    ['o PTS encerrou ou mudou a data nesse meio-tempo', [[]]],
    ['o ciclo já foi avisado', [[{ id: 'pts-1' }], [{ id: 'n1' }]]],
  ])('não avisa quando %s', async (_name, results) => {
    const { repository, query } = setup(results);

    expect(await repository.createReviewWindowNotices(notice)).toBe(0);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(
      false,
    );
  });
});
