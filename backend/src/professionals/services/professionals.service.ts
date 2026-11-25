// Este arquivo concentra as regras de profissionais: a consulta, o cadastro e
// a troca de especialidade do perfil profissional.
// As queries ficam no ProfessionalsRepository; aqui ficam as regras do
// cadastro, o erro seguro, a conversão para o contrato público e os
// metadados da paginação.

import {
  BadRequestException,
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
import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import type { Professional } from '../entities/professional.entity';
import type { CreateProfessionalRequestDto } from '../dto/create-professional-request.dto';
import type { UpdateProfessionalRequestDto } from '../dto/update-professional-request.dto';
import type { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import type {
  GetProfessionalsResponseDto,
  ProfessionalSummaryResponseDto,
} from '../dto/get-professionals-response.dto';
import type { ProfessionalProfileResponseDto } from '../dto/professional-profile-response.dto';
import {
  SPECIALISM_COUNCILS,
  SPECIALISM_NAMES,
  toProfessionalRegistration,
} from '../professional-registration';
import {
  type ProfessionalRow,
  type ProfessionalsPage,
  ProfessionalsRepository,
} from '../repositories/professionals.repository';

/** Código do Postgres para violação de chave única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

/** Erro `409` de conta que já tem perfil profissional (RN002). */
function professionalProfileAlreadyExists(): ConflictException {
  return new ConflictException({
    status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
    message: 'A conta já possui um perfil profissional.',
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
   * O e-mail só vai para o admin e para o profissional (telas-listagem,
   * DP011); para as outras contas, sai `null`.
   *
   * @param account contexto da conta autenticada
   * @param request parâmetros já validados pelo ValidationPipe global
   * @returns profissionais compatíveis e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAll(
    account: AccountContext,
    request: GetProfessionalsRequestDto,
  ): Promise<GetProfessionalsResponseDto> {
    let page: ProfessionalsPage;

    try {
      // O profissional de conta desativada só aparece para o admin (RFAUT005).
      page = await this.professionalsRepository.findPaginated({
        ...request,
        // A situação é filtro do admin; os demais só veem os ativos.
        status: isAdmin(account) ? request.status : undefined,
        includeInactive: isAdmin(account),
      });
    } catch (error) {
      this.logger.error('Professionals query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os profissionais.',
      });
    }

    const { rows, total } = page;
    const admin = isAdmin(account);
    const canSeeEmail = admin || account.professionalProfileIds.length > 0;

    return {
      data: rows.map((row) => ({
        ...this.toResponse(row),
        accountId: admin ? row.professional_account_id : null,
        email: canSeeEmail ? row.account_email : null,
      })),
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
   * não pode ser de admin nem ter perfil de paciente, e tem no máximo um
   * perfil profissional.
   *
   * @param request corpo já validado pelo ValidationPipe global
   * @param createdByAccountId conta do admin da sessão (RFPRO002)
   * @returns perfil criado, com os dados públicos da conta
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   * @throws ConflictException `ADMIN_ACCOUNT_NOT_ALLOWED` quando a conta é de
   *   admin, `ACCOUNT_HAS_PATIENT_PROFILE` quando ela tem perfil de paciente e
   *   `PROFESSIONAL_PROFILE_ALREADY_EXISTS` quando já tem perfil
   *   profissional, inclusive em pedidos simultâneos
   * @throws InternalServerErrorException quando a gravação falha por outro
   *   motivo, sem expor o erro original
   */
  async create(
    request: CreateProfessionalRequestDto,
    createdByAccountId: string,
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

    if (account.professionalProfiles?.length) {
      throw professionalProfileAlreadyExists();
    }

    const councilNumber = request.councilNumber.trim();
    // Opcional vazio não é gravado (vira null).
    const institution = request.institution?.trim() || null;
    const cnes = request.cnes ?? null;

    let id: string;

    try {
      id = await this.professionalsRepository.insert({
        accountId: account.id,
        specialism: request.specialism,
        councilNumber,
        councilState: request.councilState,
        institution,
        cnes,
        createdByAccountId,
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
      registration: {
        council: SPECIALISM_COUNCILS[request.specialism],
        number: councilNumber,
        state: request.councilState,
      },
      institution,
      cnes,
      deactivatedAt: null,
    };
  }

  /**
   * Troca a especialidade de um perfil profissional (RFPRO003, RN026).
   *
   * Mesmo conselho mantém o registro; outro conselho exige o novo número e UF
   * e os grava no lugar do anterior. As equipes dos PTS não são tocadas.
   *
   * @param id id do perfil
   * @param request corpo já validado pelo ValidationPipe global
   * @returns perfil profissional atualizado
   * @throws NotFoundException `PROFESSIONAL_NOT_FOUND` quando o perfil não
   *   existe
   * @throws BadRequestException `VALIDATION_ERROR` quando o conselho muda e
   *   faltam o número ou a UF do novo registro
   * @throws InternalServerErrorException quando a consulta ou a gravação
   *   falha, sem expor o erro original
   */
  async update(
    id: string,
    request: UpdateProfessionalRequestDto,
  ): Promise<ProfessionalProfileResponseDto> {
    const failure = () =>
      new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível atualizar o perfil profissional.',
      });
    let professional: Professional | null;

    try {
      professional = await this.professionalsRepository.findById(id);
    } catch (error) {
      this.logger.error('Professional profile query failed', error);
      throw failure();
    }

    if (!professional?.account) {
      throw new NotFoundException({
        status: 'PROFESSIONAL_NOT_FOUND',
        message: 'Profissional não encontrado.',
      });
    }

    const changesCouncil =
      SPECIALISM_COUNCILS[request.specialism] !==
      SPECIALISM_COUNCILS[professional.specialism];
    const councilNumber = request.councilNumber?.trim();

    if (changesCouncil && (!councilNumber || !request.councilState)) {
      throw new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: 'Informe o número e a UF do registro no novo conselho.',
      });
    }

    // Mesmo conselho mantém o registro; o enviado no corpo é ignorado.
    const registration = changesCouncil
      ? { councilNumber: councilNumber!, councilState: request.councilState! }
      : {
          councilNumber: professional.councilNumber,
          councilState: professional.councilState,
        };

    try {
      await this.professionalsRepository.update(professional.id, {
        specialism: request.specialism,
        ...registration,
      });
    } catch (error) {
      this.logger.error('Professional profile update failed', error);
      throw failure();
    }

    return {
      id: professional.id,
      accountId: professional.accountId,
      name: professional.account.name,
      email: professional.account.email,
      specialism: {
        id: request.specialism,
        name: SPECIALISM_NAMES[request.specialism],
      },
      registration: toProfessionalRegistration(
        request.specialism,
        registration.councilNumber,
        registration.councilState,
      ),
      institution: professional.institution,
      cnes: professional.cnes,
      deactivatedAt: professional.account.deactivatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Converte uma linha projetada pelo banco no contrato público da API.
   */
  private toResponse(row: ProfessionalRow): ProfessionalSummaryResponseDto {
    return {
      id: row.professional_id,
      accountId: null,
      name: row.account_name,
      email: row.account_email,
      specialism: {
        id: row.professional_specialism,
        name: SPECIALISM_NAMES[row.professional_specialism],
      },
      registration: toProfessionalRegistration(
        row.professional_specialism,
        row.professional_council_number,
        row.professional_council_state,
      ),
      institution: row.professional_institution,
      cnes: row.professional_cnes,
      status: row.account_status,
    };
  }
}
