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
import { Repository } from 'typeorm';
import { toPagination } from '../../common/pagination/pagination';
import type { ChangePasswordRequestDto } from '../../auth/dto/change-password-request.dto';
import type { MeResponseDto } from '../../auth/dto/me-response.dto';
import type { UpdateMeRequestDto } from '../../auth/dto/update-me-request.dto';
import type { GetAccountsRequestDto } from '../dto/get-accounts-request.dto';
import type { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';
import {
  type AccountsPage,
  AccountsRepository,
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
}

export interface AccountContext {
  accountId: string;
  role: AccountRole;
  patientProfileId: string | null;
  professionalProfileIds: string[];
}

const SUPERTOKENS_TENANT_ID = 'public';
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
      role: AccountRole.User,
      lastUpdatedAt: null,
    });

    return await this.accountRepository.save(account);
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
    const nextName = request.name?.trim() ?? account.name;
    const nextEmail = request.email?.trim().toLowerCase() ?? account.email;
    const emailChanged = nextEmail !== account.email;

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

    try {
      await this.accountRepository.save({
        ...account,
        name: nextName,
        email: nextEmail,
        lastUpdatedAt: new Date(),
      });
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

    return {
      accountId: account.id,
      name: nextName,
      email: nextEmail,
      role: account.role,
      patientProfileId: accountContext.patientProfileId,
      professionalProfileIds: accountContext.professionalProfileIds,
    };
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
   * Lista as contas (id e nome) para seleção, com filtros opcionais.
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
        name: row.account_name,
      })),
      pagination: toPagination(request, page.total),
    };
  }
}
