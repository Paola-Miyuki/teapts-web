import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';

export interface AccountContext {
  accountId: string;
  role?: string;
  patientProfileId?: string | null;
  professionalProfileIds?: string[];
  accountName?: string;
  accountEmail?: string;
}

export class AccountIntegrityError extends Error {
  constructor(message = 'Conta de negócio não encontrada para o usuário') {
    super(message);
    this.name = 'AccountIntegrityError';
  }
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    return account;
  }

  async createAccount(input: CreateAccountDto): Promise<Account> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingAccount = await this.accountRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingAccount) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    const account = this.accountRepository.create({
      supertokensUserId: input.supertokensUserId,
      email: normalizedEmail,
      name: input.name,
    });

    return await this.accountRepository.save(account);
  }

  async createForSupertokensUser(data: {
    supertokensUserId: string;
    name: string;
    email: string;
  }): Promise<Account> {
    return this.createAccount(data);
  }

  async resolveAccountContext(supertokensUserId: string): Promise<AccountContext> {
    const account = await this.accountRepository.findOne({
      where: { supertokensUserId },
    });

    if (!account) {
      throw new AccountIntegrityError();
    }

    return {
      accountId: account.id,
      accountName: account.name,
      accountEmail: account.email,
      role: (account as any).role || 'USER',
      patientProfileId: (account as any).patientProfileId || null,
      professionalProfileIds: (account as any).professionalProfileIds || [],
    };
  }
}