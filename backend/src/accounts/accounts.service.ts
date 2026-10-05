// Este arquivo concentra as consultas de contas no banco.
// No cadastro, ele cria a conta vinculada ao usuário recém-criado no SuperTokens.
// No login, ele transforma a conta em um contexto pequeno para a sessão.
// No endpoint /me, ele busca os dados completos para a resposta.
// Erros de integridade impedem a criação de uma sessão sem conta correspondente.

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { AccountRole } from '../database/enums/account-role.enum';

/** Dados de conta necessários para autorizar e atender as rotas protegidas. */
export type AccountContext = {
  /** Identificador da conta de negócio. */
  accountId: string;
  /** Papel da conta, usado nas operações administrativas. */
  role: AccountRole;
  /** Perfil de paciente (Patient.accountId) ou null quando não houver. */
  patientProfileId: string | null;
  /** Perfis profissionais (Professional.id); array vazio significa nenhum. */
  professionalProfileIds: string[];
};

/** Dados usados para criar a conta logo após o signup no SuperTokens. */
export type NewAccount = {
  /** Identificador do usuário criado no SuperTokens. */
  supertokensUserId: string;
  /** Nome informado no formulário de cadastro. */
  name: string;
  /** E-mail já normalizado pelo SuperTokens. */
  email: string;
};

/** Erro 5xx usado quando a identidade não tem uma conta íntegra. */
export class AccountIntegrityError extends InternalServerErrorException {
  /** Cria uma falha genérica de integridade, sem expor detalhes internos. */
  constructor() {
    super('Erro interno de integridade da conta');
  }
}

/**
 * Consulta contas no banco e transforma seus dados em informações
 * que podem ser colocadas no payload da sessão.
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Cria a conta de negócio vinculada a um usuário do SuperTokens.
   *
   * A senha não é armazenada: ela pertence somente ao SuperTokens.
   *
   * @param newAccount vínculo com o SuperTokens, nome e e-mail
   * @returns conta criada com o papel padrão
   * @throws erro do banco, por exemplo quando o e-mail ou o vínculo já existem
   */
  async createForSupertokensUser(newAccount: NewAccount): Promise<Account> {
    return this.accountRepository.save(
      this.accountRepository.create({
        ...newAccount,
        role: AccountRole.User,
        lastUpdatedAt: null,
      }),
    );
  }

  /**
   * Localiza a conta vinculada ao usuário autenticado do SuperTokens.
   *
   * A exceção impede que uma identidade sem conta de negócio continue
   * o fluxo de login como se estivesse corretamente configurada.
   *
   * @param supertokensUserId identificador do usuário no SuperTokens
   * @returns contexto mínimo que será colocado na sessão
   * @throws AccountIntegrityError quando a conta não existe ou não tem id válido
   */
  async resolveAccountContext(
    supertokensUserId: string,
  ): Promise<AccountContext> {
    const account = await this.accountRepository.findOne({
      where: { supertokensUserId },
      relations: { patientProfile: true, professionalProfiles: true },
    });

    if (!account) {
      throw new AccountIntegrityError();
    }

    if (typeof account.id !== 'string' || account.id.trim() === '') {
      throw new AccountIntegrityError();
    }

    return {
      accountId: account.id,
      role: account.role,
      patientProfileId: account.patientProfile?.accountId ?? null,
      professionalProfileIds: (account.professionalProfiles ?? []).map(
        (professional) => professional.id,
      ),
    };
  }

  /**
   * Busca os dados públicos básicos de uma conta para o endpoint `/me`.
   *
   * @param id identificador da conta de negócio
   * @returns entidade da conta encontrada
   * @throws NotFoundException quando a conta não existe
   */
  async findById(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({ where: { id } });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    return account;
  }
}
