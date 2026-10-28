import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toPagination } from '../../common/pagination/pagination';
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
