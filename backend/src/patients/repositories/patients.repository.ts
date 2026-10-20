// Este arquivo concentra a consulta de pacientes autorizados no banco.
// A query usa as entidades existentes e mantém a projeção pública da resposta.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Patient } from '../entities/patient.entity';


/** Estados de PTS considerados ativos para a consulta. */
export const ACTIVE_PTS_STATES = ['planning', 'running'];

/** Filtros e paginação já validados da consulta de pacientes autorizados. */
export type AuthorizedPatientsQuery = {
  page: number;
  limit: number;
};

/** Linha projetada pela consulta, só com os campos públicos. */
export type AuthorizedPatientRow = {
  patient_id: string;
  account_name: string;
};

/** Página de linhas e total de pacientes autorizados. */
export type AuthorizedPatientsPage = {
  rows: AuthorizedPatientRow[];
  total: number;
};

/**
 * Acesso aos dados dos pacientes autorizados.
 */
@Injectable()
export class PatientsRepository {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Busca pacientes de PTS ativos aos quais a conta tem acesso.
   *
   * O responsável do PTS conta como membro da equipe, conforme a RN005.
   * A consulta usa offset/limit porque getRawMany ignora skip/take quando
   * há JOIN.
   *
   * @param accountId identificador da conta autenticada
   * @param filters filtros e paginação já validados
   * @returns linhas da página pedida e total de pacientes autorizados
   * @throws erro do banco, sem tratamento
   */
  async findAuthorizedPaginated(
    accountId: string,
    filters: AuthorizedPatientsQuery,
  ): Promise<AuthorizedPatientsPage> {
    const query = this.patientRepository
      .createQueryBuilder('patient')
      .innerJoin(Account, 'account', 'account.id = patient."accountId"')
      .select([
        'patient."accountId" AS patient_id',
        'account.name AS account_name',
      ])
      .where(
        `patient."accountId" IN (
    SELECT pts.patient_id
    FROM projeto_terapeutico_singular pts
    WHERE pts.status IN (:...states)
      AND (
        pts.responsible_professional_id IN (
          SELECT id FROM professional WHERE "accountId" = :accountId
        )
        OR EXISTS (
          SELECT 1
          FROM professional_participating_on_therapeutic_journey participation
          INNER JOIN professional ON professional.id = participation.professional_id
          WHERE participation.therapeutic_journey_id = pts.id
            AND professional."accountId" = :accountId
        )
      )
  )`,
        { accountId, states: ACTIVE_PTS_STATES },
      )
      .orderBy('account.name', 'ASC')
      .addOrderBy('patient."accountId"', 'ASC');

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<AuthorizedPatientRow>();

    return { rows, total };
  }
}
