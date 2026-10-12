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
}
