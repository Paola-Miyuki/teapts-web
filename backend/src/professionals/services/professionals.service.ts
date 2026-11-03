// Este arquivo concentra as regras de profissionais: a consulta e o cadastro
// do perfil profissional.
// As queries ficam no ProfessionalsRepository; aqui ficam as regras do
// cadastro, o erro seguro, a conversão para o contrato público e os
// metadados da paginação.

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
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { Specialism } from '../enums/specialism.enum';
import type { CreateProfessionalRequestDto } from '../dto/create-professional-request.dto';
import type { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import type {
  GetProfessionalsResponseDto,
  ProfessionalSummaryResponseDto,
} from '../dto/get-professionals-response.dto';
import type { ProfessionalProfileResponseDto } from '../dto/professional-profile-response.dto';
import {
  type ProfessionalRow,
  type ProfessionalsPage,
  ProfessionalsRepository,
} from '../repositories/professionals.repository';

const SPECIALISM_NAMES: Record<Specialism, string> = {
  [Specialism.Psychologist]: 'Psicologia',
  [Specialism.Doctor]: 'Medicina',
  [Specialism.Physiotherapist]: 'Fisioterapia',
};

/** Código do Postgres para violação de chave única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

/** Erro `409` de conta que já tem perfil com a mesma especialidade (RN002). */
function professionalProfileAlreadyExists(): ConflictException {
  return new ConflictException({
    status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
    message: 'A conta já possui um perfil profissional com essa especialidade.',
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
 * Consulta e cadastra perfis profissionais, expondo só os campos públicos.
 */
@Injectable()
export class ProfessionalsService {
  private readonly logger = new Logger(ProfessionalsService.name);

  constructor(
    private readonly professionalsRepository: ProfessionalsRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Busca profissionais com filtros combináveis e paginação.
   *
   * @param request parâmetros já validados pelo ValidationPipe global
   * @returns profissionais compatíveis e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAll(
    request: GetProfessionalsRequestDto,
  ): Promise<GetProfessionalsResponseDto> {
    let page: ProfessionalsPage;

    try {
      page = await this.professionalsRepository.findPaginated(request);
    } catch (error) {
      this.logger.error('Professionals query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os profissionais.',
      });
    }

    const { rows, total } = page;

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: {
        page: request.page,
        limit: request.limit,
        total,
        totalPages: Math.ceil(total / request.limit),
      },
    };
  }

  /**
   * Cadastra um perfil profissional para uma conta de usuário comum.
   *
   * Admin, paciente e profissional usam contas separadas (RN002): a conta
   * não pode ser de admin nem ter perfil de paciente. Uma conta pode ter
   * vários perfis profissionais, um por especialidade.
   *
   * @param request corpo já validado pelo ValidationPipe global
   * @returns perfil criado, com os dados públicos da conta
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   * @throws ConflictException `ADMIN_ACCOUNT_NOT_ALLOWED` quando a conta é de
   *   admin, `ACCOUNT_HAS_PATIENT_PROFILE` quando ela tem perfil de paciente e
   *   `PROFESSIONAL_PROFILE_ALREADY_EXISTS` quando já tem perfil com a mesma
   *   especialidade, inclusive em pedidos simultâneos
   * @throws InternalServerErrorException quando a gravação falha por outro
   *   motivo, sem expor o erro original
   */
  async create(
    request: CreateProfessionalRequestDto,
  ): Promise<ProfessionalProfileResponseDto> {
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
        message: 'Conta de administrador não pode ter perfil profissional.',
      });
    }

    if (account.patientProfile) {
      throw new ConflictException({
        status: 'ACCOUNT_HAS_PATIENT_PROFILE',
        message: 'A conta já possui um perfil de paciente.',
      });
    }

    const hasSameSpecialism = (account.professionalProfiles ?? []).some(
      (profile) => profile.specialism === request.specialism,
    );

    if (hasSameSpecialism) {
      throw professionalProfileAlreadyExists();
    }

    let id: string;

    try {
      id = await this.professionalsRepository.insert({
        accountId: account.id,
        specialism: request.specialism,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw professionalProfileAlreadyExists();
      }

      this.logger.error('Professional profile insert failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível cadastrar o perfil profissional.',
      });
    }

    return {
      id,
      accountId: account.id,
      name: account.name,
      email: account.email,
      specialism: {
        id: request.specialism,
        name: SPECIALISM_NAMES[request.specialism],
      },
      deactivatedAt: null,
    };
  }

  /**
   * Converte uma linha projetada pelo banco no contrato público da API.
   */
  private toResponse(row: ProfessionalRow): ProfessionalSummaryResponseDto {
    return {
      id: row.professional_id,
      name: row.account_name,
      email: row.account_email,
      specialism: {
        id: row.professional_specialism,
        name: SPECIALISM_NAMES[row.professional_specialism],
      },
    };
  }
}
