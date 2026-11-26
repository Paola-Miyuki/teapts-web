import type { EntityManager } from 'typeorm';

/**
 * Próxima versão do paciente. Trava o paciente: duas criações simultâneas não
 * recebem o mesmo número. Conta também as propostas excluídas, que continuam
 * ocupando a versão.
 */
export async function nextPtsVersion(
  manager: EntityManager,
  patientId: string,
): Promise<number> {
  await manager.query(
    'SELECT account_id FROM patient WHERE account_id = $1 FOR UPDATE',
    [patientId],
  );
  const [{ max }] = await manager.query<{ max: number | null }[]>(
    'SELECT MAX(version) AS max FROM projeto_terapeutico_singular WHERE patient_id = $1',
    [patientId],
  );

  return (max ?? 0) + 1;
}
