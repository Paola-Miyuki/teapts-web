// Este arquivo concentra as regras de pacientes: a consulta de pacientes
// autorizados, o cadastro do perfil de paciente e a consulta e atualização
// dos contatos de suporte.
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
import type { GetAuthorizedPatientsResponseDto } from '../dto/get-authorized-patients-response.dto';
import type { PatientResponseDto } from '../dto/patient-response.dto';
import type { SupportContactDto } from '../dto/support-contact.dto';
import type { UpdateSupportContactsRequestDto } from '../dto/update-support-contacts-request.dto';
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

/** Erro `404` de paciente inexistente. */
function patientNotFound(): NotFoundException {
  return new NotFoundException({
    status: 'PATIENT_NOT_FOUND',
    message: 'Paciente não encontrado.',
  });
}

/**
 * Garante que a conta é admin (RN022, mesma checagem do AdminGuard) ou o
 * próprio paciente. Contato de suporte não entra aqui (RN017); o responsável
 * tutelar entra quando a RFACL001 existir.
 *
 * Roda antes da busca do paciente para não revelar a quem não tem acesso se
 * o paciente existe.
 *
 * @throws ForbiddenException `FORBIDDEN` para qualquer outra conta
 */
function assertCanManageSupportContacts(
  account: AccountContext,
  patientId: string,
): void {
  if (isAdmin(account) || account.patientProfileId === patientId) {
    return;
  }

  throw new ForbiddenException({
    status: 'FORBIDDEN',
    message: 'Acesso restrito ao administrador ou ao próprio paciente.',
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
    let page: AuthorizedPatientsPage;

    try {
      page = isAdmin(account)
        ? await this.patientsRepository.findAllPaginated(request)
        : await this.patientsRepository.findAuthorizedPaginated(
            account.accountId,
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
   * Busca pacientes disponíveis para criação de uma nova proposta de PTS.
   * Só a conta com perfil profissional ou o administrador consulta (RFPTS001,
   * RN022).
   */
  async findAvailableForPts(
    account: AccountContext,
    request: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
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

  /**
   * Consulta os contatos de suporte do paciente (RFPAC003).
   *
   * @param account contexto da conta autenticada
   * @param patientId accountId do perfil de paciente, já validado como UUID
   * @returns perfil com os contatos atuais
   * @throws ForbiddenException `FORBIDDEN` quando a conta não é admin nem o
   *   próprio paciente
   * @throws NotFoundException `PATIENT_NOT_FOUND` quando o paciente não existe
   * @throws InternalServerErrorException quando a consulta falha, sem expor o
   *   erro original
   */
  async findSupportContacts(
    account: AccountContext,
    patientId: string,
  ): Promise<PatientResponseDto> {
    assertCanManageSupportContacts(account, patientId);

    let supportContacts: SupportContactDto[] | null;

    try {
      supportContacts =
        await this.patientsRepository.findSupportContacts(patientId);
    } catch (error) {
      this.logger.error('Support contacts query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os contatos de suporte.',
      });
    }

    if (!supportContacts) {
      throw patientNotFound();
    }

    return { accountId: patientId, supportContacts };
  }

  /**
   * Substitui a lista inteira de contatos de suporte do paciente (RFPAC003,
   * DP012); lista vazia remove todos. Não muda nenhuma permissão: contato de
   * suporte não concede tutela nem acesso clínico (RN017).
   *
   * @param account contexto da conta autenticada
   * @param patientId accountId do perfil de paciente, já validado como UUID
   * @param request corpo já validado pelo ValidationPipe global
   * @returns perfil com os contatos gravados
   * @throws ForbiddenException `FORBIDDEN` quando a conta não é admin nem o
   *   próprio paciente
   * @throws NotFoundException `PATIENT_NOT_FOUND` quando o paciente não existe
   * @throws InternalServerErrorException quando a gravação falha, sem expor o
   *   erro original
   */
  async updateSupportContacts(
    account: AccountContext,
    patientId: string,
    request: UpdateSupportContactsRequestDto,
  ): Promise<PatientResponseDto> {
    assertCanManageSupportContacts(account, patientId);

    const supportContacts = request.supportContacts.map(toSupportContact);
    let updated: boolean;

    try {
      updated = await this.patientsRepository.updateSupportContacts(
        patientId,
        supportContacts,
      );
    } catch (error) {
      this.logger.error('Support contacts update failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível atualizar os contatos de suporte.',
      });
    }

    if (!updated) {
      throw patientNotFound();
    }

    return { accountId: patientId, supportContacts };
  }
}
