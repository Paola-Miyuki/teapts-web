import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { AccountRole } from '../database/enums/account-role.enum';

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
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async createForSupertokensUser(
    dto: CreateForSupertokensUserDto,
  ): Promise<Account> {
    const account = this.accountRepository.create({
      supertokensUserId: dto.supertokensUserId,
      name: dto.name,
      email: dto.email,
      role: AccountRole.User,
      lastUpdatedAt: null,
    });

    return await this.accountRepository.save(account);
  }

  async findBySupertokensUserId(supertokensUserId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { supertokensUserId },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada para este usuário');
    }

    return account;
  }

  async resolveAccountContext(
    supertokensUserId: string,
  ): Promise<AccountContext> {
    const account = (await this.accountRepository.findOne({
      where: { supertokensUserId },
      relations: { patientProfile: true, professionalProfiles: true },
    })) as Account | null;

    if (!account || !account.id || !account.id.trim()) {
      throw new AccountIntegrityError();
    }

    return {
      accountId: account.id,
      role: account.role,
      patientProfileId: account.patientProfile
        ? account.patientProfile.accountId ?? (account.patientProfile as any).id
        : null,
      professionalProfileIds: account.professionalProfiles
        ? account.professionalProfiles.map((p: any) => p.id)
        : [],
    };
  }

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id } as any,
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    return account;
  }
}