// Este arquivo concentra a consulta SQL dos pacientes autorizados.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { Patient } from '../database/entities/patient.entity';
import type { GetAuthorizedPatientsRequestDto } from './dto/get-authorized-patients-request.dto';
import type { GetAuthorizedPatientsResponseDto } from './dto/get-authorized-patients-response.dto';

export const ACTIVE_PTS_STATES = ['planning', 'running'];

type AuthorizedPatientRow = {
  patient_id: string;
  account_name: string;
};

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  /**
   * Busca pacientes relacionados a PTS ativos aos quais a conta tem acesso.
   *
   * O accountId vem do contexto autenticado, e o responsável do PTS conta
   * como membro da equipe, conforme a RN005. A consulta usa offset/limit
   * porque getRawMany ignora skip/take quando há JOIN.
   *
   * @param accountId identificador da conta autenticada
   * @param request parâmetros de paginação já normalizados
   * @returns pacientes autorizados e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha
   */
  async findAuthorized(
    accountId: string,
    request: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    try {
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
        .offset((request.page - 1) * request.limit)
        .limit(request.limit)
        .getRawMany<AuthorizedPatientRow>();

      return {
        data: rows.map((row) => ({
          id: row.patient_id,
          name: row.account_name,
        })),
        pagination: {
          page: request.page,
          limit: request.limit,
          total,
          totalPages: Math.ceil(total / request.limit),
        },
      };
    } catch (error) {
      this.logger.error('Authorized patients query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      });
    }
  }
}
