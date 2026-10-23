// Este arquivo concentra a regra da consulta de pacientes autorizados.
// A query fica no PatientsRepository; aqui ficam o erro seguro, a conversão
// para o contrato público e os metadados da paginação.
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type { GetAuthorizedPatientsResponseDto } from '../dto/get-authorized-patients-response.dto';
import {
  type AuthorizedPatientsPage,
  PatientsRepository,
} from '../repositories/patients.repository';

/**
 * Consulta pacientes autorizados usando somente os campos públicos necessários.
 */
@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(private readonly patientsRepository: PatientsRepository) {}

  /**
   * Busca pacientes relacionados a PTS ativos aos quais a conta tem acesso.
   *
   * @param accountId identificador da conta autenticada
   * @param request parâmetros já validados pelo ValidationPipe global
   * @returns pacientes autorizados e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAuthorized(
    accountId: string,
    request: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    let page: AuthorizedPatientsPage;

    try {
      page = await this.patientsRepository.findAuthorizedPaginated(
        accountId,
        request,
      );
    } catch (error) {
      this.logger.error('Authorized patients query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      });
    }

    const { rows, total } = page;

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
  }
}
