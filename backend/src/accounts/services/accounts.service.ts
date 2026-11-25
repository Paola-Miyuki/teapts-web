import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { convertToRecipeUserId } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { Repository } from 'typeorm';
import { toPagination } from '../../common/pagination/pagination';
import type { ChangePasswordRequestDto } from '../../auth/dto/change-password-request.dto';
import type { MeResponseDto } from '../../auth/dto/me-response.dto';
import type { UpdateMeRequestDto } from '../../auth/dto/update-me-request.dto';
import type { DeactivateAccountResponseDto } from '../dto/deactivate-account-response.dto';
import type { GetAccountResponseDto } from '../dto/get-account-response.dto';
import type { GetAccountsRequestDto } from '../dto/get-accounts-request.dto';
import type { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import type { Gender } from '../enums/gender.enum';
import type { Sex } from '../enums/sex.enum';
import {
  type AccountsPage,
  AccountsRepository,
  type DeactivationResult,
} from '../repositories/accounts.repository';

export class AccountIntegrityError extends Error {
  constructor(message = 'Inconsistência nos dados da conta') {
    super(message);
    this.name = 'AccountIntegrityError';
  }
}

export interface CreateForSupertokensUserDto {
  supertokensUserId: string;
  name: string;
  email: string;
  socialName: string | null;
  birthDate: string;
  sex: Sex;
  gender: Gender | null;
  /** Só dígitos. */
  cpf: string;
  /** Só dígitos, com DDD. */
  phone: string | null;
}

/** Dados pessoais da conta que podem mudar; ausente mantém o valor atual. */
export interface AccountChanges {
  name?: string;
  email?: string;
  socialName?: string | null;
  birthDate?: string;
  sex?: Sex;
  gender?: Gender | null;
  /** Só dígitos, com DDD. */
  phone?: string | null;
  /** Só dígitos. */
  cpf?: string;
}

export interface AccountContext {
  accountId: string;
  role: AccountRole;
  patientProfileId: string | null;
  professionalProfileIds: string[];
}

/** Resposta do GET/PATCH /me a partir da conta e do contexto da sessão. */
export function toMeResponse(
  account: Account,
  context: AccountContext,
): MeResponseDto {
  return {
    accountId: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    socialName: account.socialName,
    birthDate: account.birthDate,
    sex: account.sex,
    gender: account.gender,
    cpf: account.cpf,
    phone: account.phone,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.lastUpdatedAt?.toISOString() ?? null,
    patientProfileId: context.patientProfileId,
    professionalProfileIds: context.professionalProfileIds,
  };
}

const SUPERTOKENS_TENANT_ID = 'public';
const CPF_ALREADY_EXISTS_RESPONSE = {
  status: 'CPF_ALREADY_EXISTS',
  message: 'Este CPF já está cadastrado.',
};
const EMAIL_ALREADY_EXISTS_RESPONSE = {
  status: 'EMAIL_ALREADY_EXISTS',
  message: 'Este e-mail já está cadastrado.',
};

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly accountsRepository: AccountsRepository,
  ) {}

  async createAccount(dto: CreateForSupertokensUserDto): Promise<Account> {
    const account = this.accountRepository.create({
      supertokensUserId: dto.supertokensUserId,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      socialName: dto.socialName?.trim() || null,
      birthDate: dto.birthDate,
      sex: dto.sex,
      gender: dto.gender,
      cpf: dto.cpf,
      phone: dto.phone,
      role: AccountRole.User,
      lastUpdatedAt: null,
    });

    return await this.accountRepository.save(account);
  }

  /** CPF (só dígitos) já usado por outra conta (RN001). */
  async isCpfTaken(cpf: string): Promise<boolean> {
    return this.accountRepository.exists({ where: { cpf } });
  }

  async resolveAccountContext(
    supertokensUserId: string,
  ): Promise<AccountContext> {
    const account = await this.accountRepository.findOne({
      where: { supertokensUserId },
      relations: { patientProfile: true, professionalProfiles: true },
    });

    if (!account || !account.id || !account.id.trim()) {
      throw new AccountIntegrityError();
    }

    const patientProfile = account.patientProfile
      ? await account.patientProfile
      : null;
    const professionalProfiles = account.professionalProfiles
      ? await account.professionalProfiles
      : [];

    return {
      accountId: account.id,
      role: account.role,
      patientProfileId: patientProfile?.accountId ?? null,
      professionalProfileIds: professionalProfiles.map((profile) => profile.id),
    };
  }

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    return account;
  }

  /**
   * Grava os dados pessoais da conta. Trocar o e-mail muda também o
   * SuperTokens e desfaz a troca se a gravação falhar.
   *
   * @throws ConflictException `EMAIL_ALREADY_EXISTS` ou `CPF_ALREADY_EXISTS`
   */
  private async applyAccountChanges(
    account: Account,
    changes: AccountChanges,
  ): Promise<Account> {
    const nextName = changes.name?.trim() ?? account.name;
    const nextEmail = changes.email?.trim().toLowerCase() ?? account.email;
    const emailChanged = nextEmail !== account.email;

    if (
      changes.cpf !== undefined &&
      changes.cpf !== account.cpf &&
      (await this.isCpfTaken(changes.cpf))
    ) {
      throw new ConflictException(CPF_ALREADY_EXISTS_RESPONSE);
    }

    if (emailChanged) {
      const emailOwner = await this.accountRepository.findOne({
        where: { email: nextEmail },
      });

      if (emailOwner && emailOwner.id !== account.id) {
        throw new ConflictException(EMAIL_ALREADY_EXISTS_RESPONSE);
      }

      const emailUpdate = await EmailPassword.updateEmailOrPassword({
        recipeUserId: convertToRecipeUserId(account.supertokensUserId),
        email: nextEmail,
      });

      if (emailUpdate.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
        throw new ConflictException(EMAIL_ALREADY_EXISTS_RESPONSE);
      }

      if (emailUpdate.status !== 'OK') {
        throw new InternalServerErrorException(
          'Não foi possível atualizar o e-mail.',
        );
      }
    }

    const updated: Account = {
      ...account,
      name: nextName,
      email: nextEmail,
      socialName:
        changes.socialName === undefined
          ? account.socialName
          : changes.socialName?.trim() || null,
      birthDate: changes.birthDate ?? account.birthDate,
      sex: changes.sex ?? account.sex,
      gender: changes.gender === undefined ? account.gender : changes.gender,
      phone: changes.phone === undefined ? account.phone : changes.phone,
      cpf: changes.cpf ?? account.cpf,
      lastUpdatedAt: new Date(),
    };

    try {
      await this.accountRepository.save(updated);
    } catch (error) {
      if (emailChanged) {
        try {
          await EmailPassword.updateEmailOrPassword({
            recipeUserId: convertToRecipeUserId(account.supertokensUserId),
            email: account.email,
          });
        } catch (rollbackError) {
          this.logger.error(
            'Falha ao desfazer a troca de e-mail no SuperTokens.',
            rollbackError instanceof Error ? rollbackError.stack : undefined,
          );
        }
      }

      throw error;
    }

    return updated;
  }

  /**
   * Atualiza os dados pessoais de outra conta, a pedido do administrador
   * (ex.: editar paciente).
   */
  async updateAccountData(
    accountId: string,
    changes: AccountChanges,
  ): Promise<Account> {
    const account = await this.findById(accountId);

    return this.applyAccountChanges(account, changes);
  }

  async updateMe(
    accountContext: AccountContext,
    request: UpdateMeRequestDto,
  ): Promise<MeResponseDto> {
    if (request.role !== undefined) {
      throw new ForbiddenException({
        status: 'FORBIDDEN',
        message: 'Não é permitido alterar o papel da conta.',
      });
    }

    const account = await this.findById(accountContext.accountId);
    const updated = await this.applyAccountChanges(account, {
      name: request.name,
      email: request.email,
      socialName: request.socialName,
      birthDate: request.birthDate,
      sex: request.sex,
      gender: request.gender,
      phone: request.phone,
    });

    return toMeResponse(updated, accountContext);
  }

  async changePassword(
    accountContext: AccountContext,
    request: ChangePasswordRequestDto,
  ): Promise<{ status: 'OK' }> {
    const account = await this.findById(accountContext.accountId);
    const credentials = await EmailPassword.verifyCredentials(
      SUPERTOKENS_TENANT_ID,
      account.email,
      request.currentPassword,
    );

    if (credentials.status === 'WRONG_CREDENTIALS_ERROR') {
      throw new BadRequestException({
        status: 'INVALID_CURRENT_PASSWORD',
        message: 'A senha atual está incorreta.',
      });
    }

    const passwordUpdate = await EmailPassword.updateEmailOrPassword({
      recipeUserId: convertToRecipeUserId(account.supertokensUserId),
      password: request.newPassword,
      applyPasswordPolicy: true,
      tenantIdForPasswordPolicy: SUPERTOKENS_TENANT_ID,
    });

    if (passwordUpdate.status === 'PASSWORD_POLICY_VIOLATED_ERROR') {
      throw new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: passwordUpdate.failureReason,
      });
    }

    if (passwordUpdate.status !== 'OK') {
      throw new InternalServerErrorException(
        'Não foi possível atualizar a senha.',
      );
    }

    return { status: 'OK' };
  }

  /**
   * Lista as contas de usuário (id, nome e e-mail) para seleção, com a busca
   * e os filtros opcionais.
   *
   * @param request filtros e paginação já validados pelo ValidationPipe
   * @returns contas da página pedida e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAll(
    request: GetAccountsRequestDto,
  ): Promise<GetAccountsResponseDto> {
    let page: AccountsPage;

    try {
      page = await this.accountsRepository.findPaginated(request);
    } catch (error) {
      this.logger.error('Accounts query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar as contas.',
      });
    }

    return {
      data: page.rows.map((row) => ({
        id: row.account_id,
        name: row.account_social_name?.trim() || row.account_name,
        socialName: row.account_social_name,
        email: row.account_email,
        cpf: row.account_cpf,
        role: row.account_role,
        profile: row.account_profile,
        specialisms: row.account_specialisms ?? [],
        status: row.account_status,
        createdAt: new Date(row.account_created_at).toISOString(),
      })),
      pagination: toPagination(request, page.total),
    };
  }

  /**
   * Detalhe da conta para o administrador (modal "Dados da conta").
   *
   * @param id conta consultada
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   */
  async findDetail(id: string): Promise<GetAccountResponseDto> {
    const account = await this.accountRepository.findOne({
      where: { id },
      relations: { patientProfile: true, professionalProfiles: true },
    });

    if (!account) {
      throw new NotFoundException({
        status: 'ACCOUNT_NOT_FOUND',
        message: 'Conta não encontrada.',
      });
    }

    const patientProfile = account.patientProfile
      ? await account.patientProfile
      : null;
    const professionalProfiles = account.professionalProfiles
      ? await account.professionalProfiles
      : [];
    const type =
      account.role === AccountRole.Admin
        ? 'admin'
        : patientProfile
          ? 'patient'
          : professionalProfiles.length > 0
            ? 'professional'
            : 'none';

    return {
      id: account.id,
      fullName: account.name,
      socialName: account.socialName,
      birthDate: account.birthDate,
      sex: account.sex,
      gender: account.gender,
      cpf: account.cpf,
      email: account.email,
      phone: account.phone,
      role: account.role,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.lastUpdatedAt?.toISOString() ?? null,
      profile: {
        type,
        specialisms: professionalProfiles.map((profile) => profile.specialism),
      },
    };
  }

  /**
   * Diz se a conta existe e está ativa. As checagens de acesso usam o banco,
   * para uma conta desativada perder o acesso mesmo com o token ainda válido.
   *
   * @param accountId conta da sessão
   */
  async isActive(accountId: string): Promise<boolean> {
    return this.accountRepository.exists({
      where: { id: accountId, status: AccountStatus.Active },
    });
  }

  /**
   * Diz se o e-mail pertence a uma conta desativada, para o login recusá-la.
   *
   * @param email e-mail informado no login
   */
  async isEmailDeactivated(email: string): Promise<boolean> {
    return this.accountRepository.exists({
      where: {
        email: email.trim().toLowerCase(),
        status: AccountStatus.Inactive,
      },
    });
  }

  /**
   * Desativa a conta (exclusão lógica, RFAUT005, RN021): grava a situação,
   * tira o perfil profissional das equipes de PTS ativos e revoga as sessões.
   * Perfis e dados clínicos continuam no banco.
   *
   * A revogação das sessões roda depois da transação. Se ela falhar, a conta
   * já está inativa e o AuthGuard recusa as sessões que sobraram; a falha só
   * vai para o log.
   *
   * @param accountId conta a desativar
   * @param executedByAccountId conta que pediu (o titular ou o administrador)
   * @returns id, situação e momento da desativação
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   * @throws ConflictException `ACCOUNT_ALREADY_DEACTIVATED` quando a conta já
   *   está inativa e `ACCOUNT_IS_PTS_RESPONSIBLE` quando o perfil profissional
   *   é responsável por PTS em `planning` ou `running`
   * @throws InternalServerErrorException quando a gravação falha, sem expor o
   *   erro original
   */
  async deactivate(
    accountId: string,
    executedByAccountId: string,
  ): Promise<DeactivateAccountResponseDto> {
    let result: DeactivationResult;

    try {
      result = await this.accountsRepository.deactivate(
        accountId,
        executedByAccountId,
      );
    } catch (error) {
      this.logger.error('Account deactivation failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível desativar a conta.',
      });
    }

    if (result.outcome === 'not_found') {
      throw new NotFoundException({
        status: 'ACCOUNT_NOT_FOUND',
        message: 'Conta não encontrada.',
      });
    }

    if (result.outcome === 'already_deactivated') {
      throw new ConflictException({
        status: 'ACCOUNT_ALREADY_DEACTIVATED',
        message: 'A conta já está desativada.',
      });
    }

    if (result.outcome === 'pts_responsible') {
      throw new ConflictException({
        status: 'ACCOUNT_IS_PTS_RESPONSIBLE',
        message:
          'A conta tem perfil responsável por um PTS ativo. Transfira a responsabilidade antes de desativar.',
      });
    }

    try {
      await Session.revokeAllSessionsForUser(result.supertokensUserId);
    } catch (error) {
      this.logger.error(
        `Falha ao revogar as sessões da conta desativada. accountId=${accountId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      id: accountId,
      status: AccountStatus.Inactive,
      deactivatedAt: result.deactivatedAt.toISOString(),
    };
  }
}
