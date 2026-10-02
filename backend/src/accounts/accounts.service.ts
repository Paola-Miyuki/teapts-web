import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async createAccount(input: CreateAccountDto): Promise<Account> {
    const normalizedEmail = input.email.trim().toLowerCase(); // evita ambiguidade de letras maisculas tornando-as minusculas. TODAS

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
}
