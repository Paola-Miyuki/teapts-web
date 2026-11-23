// Este arquivo concentra as regras de pacientes: a consulta de pacientes
// autorizados e o cadastro do perfil de paciente.
// A query da consulta fica no PatientsRepository; aqui ficam o erro seguro, a
// conversão para o contrato público e os metadados da paginação.
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { isAdmin } from '../../auth/account-context';
import { toPagination } from '../../common/pagination/pagination';
import type { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type {
  AuthorizedPatientResponseDto,
  GetAuthorizedPatientsResponseDto,
} from '../dto/get-authorized-patients-response.dto';
import type { GetAvailablePatientsRequestDto } from '../dto/get-available-patients-request.dto';
import type { GetAvailablePatientsResponseDto } from '../dto/get-available-patients-response.dto';
import type { PatientDetailResponseDto } from '../dto/patient-detail-response.dto';
import type { PatientResponseDto } from '../dto/patient-response.dto';
import type { SupportContact } from '../entities/support-contact.entity';
import type { SupportContactDto } from '../dto/support-contact.dto';
import {
  type AuthorizedPatientsPage,
  type PatientRow,
  type PatientScope,
  type PatientsPage,
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
function forbiddenPatient(): ForbiddenException {
  return new ForbiddenException({
    status: 'FORBIDDEN',
    message: 'Acesso restrito ao profissional.',
  });
}

/**
 * Escopo de quem consulta: o administrador vê todos (RN022); o profissional,
 * os pacientes dos PTS de que faz ou fez parte (RN016). Conta sem perfil
 * profissional, que não seja de administrador, recebe 403 (RFPAC002.E04).
 */
function patientScope(account: AccountContext): PatientScope {
  if (isAdmin(account)) {
    return { kind: 'all' };
  }

  if (account.professionalProfileIds.length === 0) {
    throw forbiddenPatient();
  }

  return { kind: 'professional', accountId: account.accountId };
}

function toSupportContactResponse(contact: SupportContact): SupportContactDto {
  return {
    name: contact.name,
    ...(contact.description !== null && { description: contact.description }),
    ...(contact.email !== null && { email: contact.email }),
    ...(contact.phone !== null && { phone: contact.phone }),
  };
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toAuthorizedPatient(row: PatientRow): AuthorizedPatientResponseDto {
  return {
    id: row.patient_id,
    name: row.account_name,
    socialName: row.social_name,
    email: row.email,
    cns: row.cns,
    guardianName: row.guardian_name,
    registeredAt: toIsoDate(row.registered_at),
    ptsStatus: row.pts_status,
    activePtsId: row.active_pts_id,
    readOnly: row.read_only === true,
  };
}

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
   * O administrador recebe todos os pacientes cadastrados (RN022).
   *
   * @param account contexto da conta autenticada
   * @param request parâmetros já validados pelo ValidationPipe global
   * @returns pacientes autorizados e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAuthorized(
    account: AccountContext,
    request: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    const scope = patientScope(account);
    let page: PatientsPage;

    try {
      page = await this.patientsRepository.findPatientsPaginated(
        scope,
        request,
      );
    } catch (error) {
      this.logger.error('Authorized patients query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      });
    }

    return {
      data: page.rows.map(toAuthorizedPatient),
      pagination: toPagination(request, page.total),
    };
  }

  async findOne(
    account: AccountContext,
    patientId: string,
  ): Promise<PatientDetailResponseDto> {
    const scope = patientScope(account);
    let row: PatientRow | null;
    let exists: boolean;

    try {
      exists = await this.patientsRepository.patientExists(patientId);
      row = exists
        ? await this.patientsRepository.findPatient(scope, patientId)
        : null;
    } catch (error) {
      this.logger.error('Patient detail query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar o paciente.',
      });
    }

    if (!exists) {
      throw new NotFoundException({
        status: 'PATIENT_NOT_FOUND',
        message: 'Paciente não encontrado.',
      });
    }

    if (!row) {
      throw forbiddenPatient();
    }

    let contacts: SupportContact[];

    try {
      contacts = await this.patientsRepository.findSupportContacts(patientId);
    } catch (error) {
      this.logger.error('Patient support contacts query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar o paciente.',
      });
    }

    return {
      ...toAuthorizedPatient(row),
      cpf: row.cpf,
      supportContacts: contacts.map(toSupportContactResponse),
    };
  }

  async findAvailableForPts(
    account: AccountContext,
    request: GetAvailablePatientsRequestDto,
  ): Promise<GetAvailablePatientsResponseDto> {
    if (!isAdmin(account) && account.professionalProfileIds.length === 0) {
      throw new ForbiddenException({
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao profissional.',
      });
    }

    let page: AuthorizedPatientsPage;

    try {
      page =
        await this.patientsRepository.findAvailableForPtsPaginated(request);
    } catch (error) {
      this.logger.error('Available patients query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes disponíveis.',
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
   * Uma conta tem no máximo um perfil de paciente (RN002); admin, paciente e
   * profissional usam contas separadas (RFPAC001.E04); contato de suporte não
   * concede tutela (RN017).
   *
   * @param request corpo já validado pelo ValidationPipe global
   * @returns perfil criado
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   * @throws ConflictException `ADMIN_ACCOUNT_NOT_ALLOWED` quando a conta é de
   *   administrador
   * @throws ConflictException `ACCOUNT_HAS_PROFESSIONAL_PROFILE` quando a
   *   conta já tem perfil profissional
   * @throws ConflictException `PATIENT_PROFILE_ALREADY_EXISTS` quando a conta
   *   já tem perfil de paciente, inclusive em pedidos simultâneos
   * @throws InternalServerErrorException quando a gravação falha por outro
   *   motivo, sem expor o erro original
   */
  async create(request: CreatePatientRequestDto): Promise<PatientResponseDto> {
    const account = await this.accountRepository.findOne({
      where: { id: request.accountId },
      relations: { patientProfile: true, professionalProfiles: true },
    });

    if (!account) {
      throw new NotFoundException({
        status: 'ACCOUNT_NOT_FOUND',
        message: 'Conta não encontrada.',
      });
    }

    if (account.role === AccountRole.Admin) {
      throw new ConflictException({
        status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
        message: 'Conta de administrador não pode ter perfil de paciente.',
      });
    }

    if (account.professionalProfiles?.length) {
      throw new ConflictException({
        status: 'ACCOUNT_HAS_PROFESSIONAL_PROFILE',
        message: 'A conta já possui um perfil profissional.',
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
