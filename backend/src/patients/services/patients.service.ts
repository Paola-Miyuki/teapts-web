// Este arquivo concentra as regras de pacientes: a consulta de pacientes
// autorizados e o cadastro do perfil de paciente.
// A query da consulta fica no PatientsRepository; aqui ficam o erro seguro, a
// conversão para o contrato público e os metadados da paginação.
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { toPagination } from '../../common/pagination/pagination';
import type { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type { GetAuthorizedPatientsResponseDto } from '../dto/get-authorized-patients-response.dto';
import type { PatientResponseDto } from '../dto/patient-response.dto';
import type { SupportContactDto } from '../dto/support-contact.dto';
import {
  type AuthorizedPatientsPage,
  PatientsRepository,
} from '../repositories/patients.repository';

/** Código do Postgres para violação de chave única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

const OPTIONAL_CONTACT_FIELDS = ['description', 'email', 'phone'] as const;

/** Erro `409` de conta que já tem perfil de paciente (RN002). */
function patientProfileAlreadyExists(): ConflictException {
  return new ConflictException({
    status: 'PATIENT_PROFILE_ALREADY_EXISTS',
    message: 'A conta já possui perfil de paciente.',
  });
}

/** Diz se o erro do banco é uma violação de chave única. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: unknown } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
}

/**
 * Monta o contato salvo no banco: textos sem espaços externos e sem os
 * campos opcionais vazios.
 */
function toSupportContact(contact: SupportContactDto): SupportContactDto {
  const normalized: SupportContactDto = { name: contact.name.trim() };

  for (const field of OPTIONAL_CONTACT_FIELDS) {
    const value = contact[field]?.trim();

    if (value) {
      normalized[field] = value;
    }
  }

  return normalized;
}

/**
 * Consulta pacientes autorizados e cadastra perfis de paciente.
 */
@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly patientsRepository: PatientsRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

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
      pagination: toPagination(request, total),
    };
  }

  /**
   * Cria o perfil de paciente de uma conta existente (RFPAC001).
   *
   * Uma conta tem no máximo um perfil de paciente (RN002); contato de
   * suporte não concede tutela (RN017).
   *
   * @param request corpo já validado pelo ValidationPipe global
   * @returns perfil criado
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   * @throws ConflictException `PATIENT_PROFILE_ALREADY_EXISTS` quando a conta
   *   já tem perfil de paciente, inclusive em pedidos simultâneos
   * @throws InternalServerErrorException quando a gravação falha por outro
   *   motivo, sem expor o erro original
   */
  async create(request: CreatePatientRequestDto): Promise<PatientResponseDto> {
    const account = await this.accountRepository.findOne({
      where: { id: request.accountId },
      relations: { patientProfile: true },
    });

    if (!account) {
      throw new NotFoundException({
        status: 'ACCOUNT_NOT_FOUND',
        message: 'Conta não encontrada.',
      });
    }

    if (account.patientProfile) {
      throw patientProfileAlreadyExists();
    }

    const patient: PatientResponseDto = {
      accountId: account.id,
      supportContacts: (request.supportContacts ?? []).map(toSupportContact),
    };

    try {
      await this.patientsRepository.insert(patient);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw patientProfileAlreadyExists();
      }

      this.logger.error('Patient profile insert failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível cadastrar o perfil de paciente.',
      });
    }

    return patient;
  }
}
