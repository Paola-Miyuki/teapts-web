// Este arquivo concentra o acesso a dados de pacientes: a consulta de
// pacientes autorizados (projeção pública da resposta) e a gravação do perfil.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, type SelectQueryBuilder } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { escapeLike } from '../../common/search/escape-like';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import type {
  PatientPtsStatusFilter,
  PatientSortField,
  SortOrder,
} from '../dto/get-authorized-patients-request.dto';
import type { SupportContactDto } from '../dto/support-contact.dto';
import { Patient } from '../entities/patient.entity';
import { SupportContact } from '../entities/support-contact.entity';

/** Estados de PTS considerados ativos para a consulta. */
export const ACTIVE_PTS_STATES = [PtsStateEnum.PLANNING, PtsStateEnum.RUNNING];

/**
 * Estados de PTS que dão ao profissional acesso ao paciente (RN016): os ativos,
 * com edição, e os encerrados, só para leitura e sem prazo.
 */
export const PROFESSIONAL_ACCESS_PTS_STATES = [
  ...ACTIVE_PTS_STATES,
  PtsStateEnum.CONCLUDED,
  PtsStateEnum.CANCELLED,
];

/** Quem consulta: o administrador vê todos; o profissional, pelo vínculo. */
export type PatientScope =
  { kind: 'all' } | { kind: 'professional'; accountId: string };

/** Filtros e paginação já validados da consulta de pacientes autorizados. */
export type AuthorizedPatientsQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: PatientPtsStatusFilter[];
  responsibleProfessionalId?: string;
  registeredFrom?: string;
  registeredTo?: string;
  sort?: PatientSortField;
  order?: SortOrder;
};

/** Filtros e paginação da busca de pacientes elegíveis para uma proposta. */
export type EligiblePatientsQuery = {
  page: number;
  limit: number;
  q?: string;
};

/** Linha projetada pela busca de pacientes elegíveis (sem o CPF, DP011). */
export type EligiblePatientRow = {
  patient_id: string;
  display_name: string;
  email: string;
};

/** Página de linhas e total de pacientes elegíveis. */
export type EligiblePatientsPage = {
  rows: EligiblePatientRow[];
  total: number;
};

/** Linha da lista e do detalhe do paciente, já com o status do PTS. */
export type PatientRow = {
  patient_id: string;
  account_name: string;
  social_name: string | null;
  email: string;
  phone: string | null;
  cpf: string | null;
  cns: string | null;
  guardian_name: string | null;
  registered_at: Date | string;
  pts_status: PtsStateEnum | null;
  active_pts_id: string | null;
  read_only: boolean;
};

/** Página de linhas e total da lista de pacientes. */
export type PatientsPage = {
  rows: PatientRow[];
  total: number;
};

/** Perfil de paciente a gravar. */
export type NewPatient = {
  accountId: string;
  supportContacts: SupportContactDto[];
};

/** Campos de um contato de suporte a gravar, já normalizados. */
export type SupportContactValues = {
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  isEmergency: boolean;
};

const PROFESSIONAL_STATUS_FILTERS: PatientPtsStatusFilter[] =
  PROFESSIONAL_ACCESS_PTS_STATES;

const SORT_COLUMNS: Record<PatientSortField, string> = {
  name: 'listed.account_name',
  registeredAt: 'listed.registered_at',
};

/**
 * Busca parcial por nome, nome social, e-mail, CNS ou CPF (NFUS003). Quando o
 * termo só tem dígitos e pontuação, compara também os dígitos do CNS e do CPF.
 * Com `withCns` falso (busca de paciente elegível), o CNS fica fora.
 */
function applySearch(
  query: SelectQueryBuilder<Patient>,
  q: string | undefined,
  withCns = true,
): void {
  if (q === undefined) {
    return;
  }

  const digits = q.replace(/\D/g, '');
  const onlyDigits = digits.length > 0 && /^[\d\s.\-/]+$/.test(q);

  query.andWhere(
    new Brackets((where) => {
      for (const column of [
        'account.name',
        'account.social_name',
        'account.email',
        ...(withCns ? ['patient.cns'] : []),
        'account.cpf',
      ]) {
        where.orWhere(`${column} ILIKE :term ESCAPE '\\'`);
      }

      if (onlyDigits) {
        where.orWhere(
          `regexp_replace(account.cpf, '\\D', '', 'g') LIKE :digits`,
        );

        if (withCns) {
          where.orWhere(
            `regexp_replace(patient.cns, '\\D', '', 'g') LIKE :digits`,
          );
        }
      }
    }),
    { term: `%${escapeLike(q)}%`, digits: `%${digits}%` },
  );
}

/**
 * Acesso aos dados de pacientes.
 */
@Injectable()
export class PatientsRepository {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Lista os pacientes do escopo, com o status do PTS de cada um, a busca, os
   * filtros, a ordenação e a paginação.
   *
   * A consulta do escopo vira uma subconsulta (`listed`) para que o filtro e a
   * ordenação usem o status do PTS já calculado. Offset/limit em vez de
   * skip/take, porque getRawMany ignora skip/take.
   *
   * @param scope todos (admin) ou os do vínculo do profissional (RN016)
   * @param filters filtros e paginação já validados
   * @returns linhas da página pedida e total filtrado
   * @throws erro do banco, sem tratamento
   */
  async findPatientsPaginated(
    scope: PatientScope,
    filters: AuthorizedPatientsQuery,
  ): Promise<PatientsPage> {
    const inner = this.scopedPatients(scope);
    // Conta desativada sai da lista (RFAUT005); o detalhe segue acessível.
    inner.andWhere('account.status = :activeStatus', {
      activeStatus: AccountStatus.Active,
    });
    applySearch(inner, filters.q);

    if (filters.responsibleProfessionalId !== undefined) {
      const responsiblePts = inner
        .subQuery()
        .select('1')
        .from(PtsEntity, 'responsible_pts')
        .where('responsible_pts.patient_id = patient.accountId')
        .andWhere(
          'responsible_pts.responsible_professional_id = :responsibleProfessionalId',
        )
        .andWhere('responsible_pts.status <> :rejectedState')
        .getQuery();
      inner.andWhere(`EXISTS ${responsiblePts}`, {
        responsibleProfessionalId: filters.responsibleProfessionalId,
        rejectedState: PtsStateEnum.REJECTED,
      });
    }

    if (filters.registeredFrom !== undefined) {
      inner.andWhere('patient.registered_at >= CAST(:registeredFrom AS date)', {
        registeredFrom: filters.registeredFrom,
      });
    }

    if (filters.registeredTo !== undefined) {
      inner.andWhere(
        'patient.registered_at < CAST(:registeredTo AS date) + 1',
        { registeredTo: filters.registeredTo },
      );
    }

    const listed = this.patientRepository.manager
      .createQueryBuilder()
      .from(`(${inner.getQuery()})`, 'listed')
      .setParameters(inner.getParameters());

    const statuses =
      scope.kind === 'professional'
        ? (filters.status ?? PROFESSIONAL_STATUS_FILTERS).filter((status) =>
            PROFESSIONAL_STATUS_FILTERS.includes(status),
          )
        : filters.status;

    if (statuses !== undefined) {
      const states = statuses.filter((status) => status !== 'none');
      listed.andWhere(
        new Brackets((where) => {
          where.where('1 = 0');

          if (states.length > 0) {
            where.orWhere('listed.pts_status IN (:...statusFilter)', {
              statusFilter: states,
            });
          }

          if (statuses.includes('none')) {
            where.orWhere('listed.pts_status IS NULL');
          }
        }),
      );
    }

    const total = await listed
      .clone()
      .select('COUNT(*)', 'total')
      .getRawOne<{ total: string }>();
    const rows = await listed
      .select('listed.*')
      .orderBy(
        SORT_COLUMNS[filters.sort ?? 'name'],
        filters.order === 'desc' ? 'DESC' : 'ASC',
      )
      .addOrderBy('listed.patient_id', 'ASC')
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<PatientRow>();

    return { rows, total: Number(total?.total ?? 0) };
  }

  /**
   * Busca um paciente dentro do escopo de quem consulta.
   *
   * @param scope todos (admin) ou os do vínculo do profissional (RN016)
   * @param patientId identificador do paciente (a conta)
   * @returns a linha do paciente, ou `null` fora do escopo
   * @throws erro do banco, sem tratamento
   */
  async findPatient(
    scope: PatientScope,
    patientId: string,
  ): Promise<PatientRow | null> {
    const row = await this.scopedPatients(scope)
      .andWhere('patient.accountId = :patientId', { patientId })
      .getRawOne<PatientRow>();

    return row ?? null;
  }

  /**
   * Diz se existe perfil de paciente para a conta, sem olhar o escopo.
   *
   * @param patientId identificador do paciente (a conta)
   * @throws erro do banco, sem tratamento
   */
  async patientExists(patientId: string): Promise<boolean> {
    return this.patientRepository.exists({ where: { accountId: patientId } });
  }

  /**
   * Monta a consulta dos pacientes do escopo com o status do PTS de cada um:
   * o PTS ativo; sem ele, o mais recente sem contar os rejeitados; só com
   * rejeitados, `rejected`; sem PTS, nulo. O responsável conta como membro da
   * equipe (RN005).
   */
  private scopedPatients(scope: PatientScope): SelectQueryBuilder<Patient> {
    const query = this.patientRepository
      .createQueryBuilder('patient')
      .innerJoin(Account, 'account', 'account.id = patient.accountId');

    const latestPtsColumn = (column: string, condition: string): string =>
      query
        .subQuery()
        .select(`latest_pts.${column}`)
        .from(PtsEntity, 'latest_pts')
        .where('latest_pts.patient_id = patient.accountId')
        .andWhere(condition)
        .orderBy('latest_pts.createdAt', 'DESC')
        .limit(1)
        .getQuery();

    const activePtsId = latestPtsColumn(
      'id',
      'latest_pts.status IN (:...activeStates)',
    );
    const ptsStatus = `COALESCE(${latestPtsColumn(
      'status',
      'latest_pts.status IN (:...activeStates)',
    )}, ${latestPtsColumn(
      'status',
      'latest_pts.status <> :rejectedState',
    )}, ${latestPtsColumn('status', 'latest_pts.status = :rejectedState')})`;

    query
      .select([
        'patient.accountId AS patient_id',
        'account.name AS account_name',
        'account.social_name AS social_name',
        'account.email AS email',
        'account.phone AS phone',
        'account.cpf AS cpf',
        'patient.cns AS cns',
        'patient.guardian_name AS guardian_name',
        'patient.registered_at AS registered_at',
      ])
      .addSelect(activePtsId, 'active_pts_id')
      .addSelect(ptsStatus, 'pts_status')
      .setParameters({
        activeStates: ACTIVE_PTS_STATES,
        rejectedState: PtsStateEnum.REJECTED,
      });

    if (scope.kind === 'all') {
      return query.addSelect('false', 'read_only');
    }

    const linkedPts = (states: string): string => {
      const ownProfiles = query
        .subQuery()
        .select('own.id')
        .from(Professional, 'own')
        .where('own.accountId = :accountId')
        .getQuery();
      const teamMembership = query
        .subQuery()
        .select('1')
        .from('professional_participating_on_therapeutic_journey', 'membership')
        .innerJoin(
          Professional,
          'member',
          'member.id = membership.professional_id',
        )
        .where('membership.therapeutic_journey_id = linked_pts.id')
        .andWhere('member.accountId = :accountId')
        .getQuery();

      return query
        .subQuery()
        .select('1')
        .from(PtsEntity, 'linked_pts')
        .where('linked_pts.patient_id = patient.accountId')
        .andWhere(`linked_pts.status IN (:...${states})`)
        .andWhere(
          `(linked_pts.responsible_professional_id IN ${ownProfiles} OR EXISTS ${teamMembership})`,
        )
        .getQuery();
    };

    return query
      .addSelect(`NOT EXISTS ${linkedPts('activeStates')}`, 'read_only')
      .andWhere(`EXISTS ${linkedPts('accessStates')}`)
      .setParameters({
        accountId: scope.accountId,
        accessStates: PROFESSIONAL_ACCESS_PTS_STATES,
      });
  }

  /**
   * Busca os pacientes elegíveis para uma nova proposta de PTS (RN011): sem PTS
   * em `planning` ou `running` e sem rascunho (`draft` não excluído). A busca
   * (NFUS003) é por nome, nome social, e-mail ou CPF; o CPF não é projetado.
   *
   * @param filters busca e paginação já validadas
   * @returns linhas da página pedida e total filtrado
   * @throws erro do banco, sem tratamento
   */
  async findEligibleForProposalPaginated(
    filters: EligiblePatientsQuery,
  ): Promise<EligiblePatientsPage> {
    const query = this.patientRepository
      .createQueryBuilder('patient')
      .innerJoin(Account, 'account', 'account.id = patient.accountId')
      .select([
        'patient.accountId AS patient_id',
        'COALESCE(account.social_name, account.name) AS display_name',
        'account.email AS email',
      ])
      .where(
        `NOT EXISTS (
    SELECT 1
    FROM projeto_terapeutico_singular pts
    WHERE pts.patient_id = patient.account_id
      AND (
        pts.status IN (:...activeStates)
        OR (pts.status = :draftState AND pts.deleted_at IS NULL)
      )
  )`,
        { activeStates: ACTIVE_PTS_STATES, draftState: PtsStateEnum.DRAFT },
      );

    applySearch(query, filters.q, false);

    query
      .orderBy('COALESCE(account.social_name, account.name)', 'ASC')
      .addOrderBy('patient.accountId', 'ASC');

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<EligiblePatientRow>();

    return { rows, total };
  }

  /**
   * Lista os contatos de suporte do paciente, na ordem em que foram gravados.
   *
   * @param patientId identificador do paciente (a conta)
   * @throws erro do banco, sem tratamento
   */
  async findSupportContacts(patientId: string): Promise<SupportContact[]> {
    return this.patientRepository.manager.find(SupportContact, {
      where: { patientId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Grava o perfil de paciente e os contatos de suporte numa transação.
   *
   * @param patient conta e contatos já normalizados
   * @throws erro do banco, sem tratamento (ex.: `23505` na PK duplicada)
   */
  async insert(patient: NewPatient): Promise<void> {
    await this.patientRepository.manager.transaction(async (manager) => {
      await manager.insert(Patient, { accountId: patient.accountId });

      if (patient.supportContacts.length > 0) {
        await manager.insert(
          SupportContact,
          patient.supportContacts.map((contact) => ({
            patientId: patient.accountId,
            name: contact.name,
            description: contact.description ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            isEmergency: contact.isEmergency ?? false,
          })),
        );
      }
    });
  }

  /**
   * Busca um contato de suporte do paciente.
   *
   * @param patientId identificador do paciente (a conta)
   * @param contactId identificador do contato
   * @returns o contato, ou `null` se não existe ou é de outro paciente
   * @throws erro do banco, sem tratamento
   */
  async findSupportContact(
    patientId: string,
    contactId: string,
  ): Promise<SupportContact | null> {
    return this.patientRepository.manager.findOne(SupportContact, {
      where: { id: contactId, patientId },
    });
  }

  /**
   * Cria um contato de suporte do paciente.
   *
   * @throws erro do banco, sem tratamento
   */
  async insertSupportContact(
    patientId: string,
    values: SupportContactValues,
  ): Promise<SupportContact> {
    const manager = this.patientRepository.manager;

    return manager.save(
      SupportContact,
      manager.create(SupportContact, { ...values, patientId }),
    );
  }

  /**
   * Atualiza um contato de suporte e marca o `updated_at`.
   *
   * @returns o contato atualizado, ou `null` se não existe ou é de outro
   *   paciente
   * @throws erro do banco, sem tratamento
   */
  async updateSupportContact(
    patientId: string,
    contactId: string,
    values: SupportContactValues,
  ): Promise<SupportContact | null> {
    const manager = this.patientRepository.manager;
    const result = await manager.update(
      SupportContact,
      { id: contactId, patientId },
      { ...values, updatedAt: () => 'now()' },
    );

    if (!result.affected) {
      return null;
    }

    return this.findSupportContact(patientId, contactId);
  }

  /**
   * Remove um contato de suporte do paciente.
   *
   * @returns `false` se o contato não existe ou é de outro paciente
   * @throws erro do banco, sem tratamento
   */
  async deleteSupportContact(
    patientId: string,
    contactId: string,
  ): Promise<boolean> {
    const result = await this.patientRepository.manager.delete(SupportContact, {
      id: contactId,
      patientId,
    });

    return (result.affected ?? 0) > 0;
  }
}
