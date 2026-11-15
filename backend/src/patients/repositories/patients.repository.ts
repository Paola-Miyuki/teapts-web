// Este arquivo concentra o acesso a dados de pacientes: a consulta de
// pacientes autorizados (projeção pública da resposta), a gravação do perfil
// e a leitura e substituição dos contatos de suporte.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { SupportContactDto } from '../dto/support-contact.dto';
import { Patient } from '../entities/patient.entity';

/** Estados de PTS considerados ativos para a consulta. */
export const ACTIVE_PTS_STATES = [PtsStateEnum.PLANNING, PtsStateEnum.RUNNING];

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

/** Perfil de paciente a gravar. */
export type NewPatient = {
  accountId: string;
  supportContacts: SupportContactDto[];
};

/** Expressão SQL que converte a lista de textos JSON em `jsonb[]`. */
const SUPPORT_CONTACTS_AS_JSONB_ARRAY = 'CAST(:supportContacts AS jsonb[])';

/**
 * Converte os contatos no parâmetro de `SUPPORT_CONTACTS_AS_JSONB_ARRAY`.
 *
 * O TypeORM grava coluna jsonb com JSON.stringify do valor inteiro, o que
 * gera um literal inválido para `jsonb[]` ("malformed array literal"). Por
 * isso cada contato vai como texto JSON, e o banco converte a lista.
 */
function toSupportContactsParameter(contacts: SupportContactDto[]): string[] {
  return contacts.map((contact) => JSON.stringify(contact));
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

  /**
   * Busca todos os pacientes cadastrados, na mesma projeção e ordenação da
   * consulta de autorizados. Usada pelo administrador (RN022).
   *
   * @param filters paginação já validada
   * @returns linhas da página pedida e total de pacientes
   * @throws erro do banco, sem tratamento
   */
  async findAllPaginated(
    filters: AuthorizedPatientsQuery,
  ): Promise<AuthorizedPatientsPage> {
    const query = this.patientRepository
      .createQueryBuilder('patient')
      .innerJoin(Account, 'account', 'account.id = patient."accountId"')
      .select([
        'patient."accountId" AS patient_id',
        'account.name AS account_name',
      ])
      .orderBy('account.name', 'ASC')
      .addOrderBy('patient."accountId"', 'ASC');

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<AuthorizedPatientRow>();

    return { rows, total };
  }

  /**
   * Busca pacientes que podem receber uma nova proposta de PTS.
   *
   * Propostas em DRAFT não impedem uma nova proposta; somente PTS em
   * PLANNING ou RUNNING tornam o paciente indisponível para criação.
   */
  async findAvailableForPtsPaginated(
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
        `NOT EXISTS (
    SELECT 1
    FROM projeto_terapeutico_singular pts
    WHERE pts.patient_id = patient."accountId"
      AND pts.status IN (:...states)
  )`,
        { states: ACTIVE_PTS_STATES },
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

  /**
   * Grava o perfil de paciente. Os contatos vão como `jsonb[]`
   * (`toSupportContactsParameter`).
   *
   * @param patient conta e contatos já normalizados
   * @throws erro do banco, sem tratamento (ex.: `23505` na PK duplicada)
   */
  async insert(patient: NewPatient): Promise<void> {
    await this.patientRepository
      .createQueryBuilder()
      .insert()
      .into(Patient)
      .values({
        accountId: patient.accountId,
        supportContacts: () => SUPPORT_CONTACTS_AS_JSONB_ARRAY,
      })
      .setParameter(
        'supportContacts',
        toSupportContactsParameter(patient.supportContacts),
      )
      .execute();
  }

  /**
   * Busca os contatos de suporte do paciente (RFPAC003).
   *
   * @param patientId accountId do perfil de paciente
   * @returns contatos gravados, ou `null` quando o paciente não existe
   * @throws erro do banco, sem tratamento
   */
  async findSupportContacts(
    patientId: string,
  ): Promise<SupportContactDto[] | null> {
    const patient = await this.patientRepository.findOne({
      select: { accountId: true, supportContacts: true },
      where: { accountId: patientId },
    });

    return patient ? patient.supportContacts : null;
  }

  /**
   * Substitui a lista inteira de contatos de suporte do paciente (RFPAC003,
   * DP012). É um único UPDATE: a lista nova entra inteira ou nada muda.
   *
   * @param patientId accountId do perfil de paciente
   * @param supportContacts lista nova, já normalizada (pode ser vazia)
   * @returns `false` quando o paciente não existe
   * @throws erro do banco, sem tratamento
   */
  async updateSupportContacts(
    patientId: string,
    supportContacts: SupportContactDto[],
  ): Promise<boolean> {
    const result = await this.patientRepository
      .createQueryBuilder()
      .update(Patient)
      .set({ supportContacts: () => SUPPORT_CONTACTS_AS_JSONB_ARRAY })
      .where('"accountId" = :patientId', { patientId })
      .setParameter(
        'supportContacts',
        toSupportContactsParameter(supportContacts),
      )
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
