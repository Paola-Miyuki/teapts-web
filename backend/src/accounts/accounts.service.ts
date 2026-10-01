// Este arquivo concentra as consultas de contas no banco.
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
import { Account } from './account.entity';

/** Dados de conta necessários para autorizar e atender as rotas protegidas. */
export type AccountContext = {
  /** Identificador da conta de negócio. */
  accountId: string;
  /** Perfil de paciente ou null quando não houver vínculo. */
  patientProfileId: string | null;
  /** Perfis profissionais; array vazio significa nenhum perfil. */
  professionalProfileIds: string[];
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
    });

    if (!account) {
      throw new AccountIntegrityError();
    }

    if (typeof account.id !== 'string' || account.id.trim() === '') {
      throw new AccountIntegrityError();
    }

    return {
      accountId: account.id,
      patientProfileId: account.patientProfileId ?? null,
      professionalProfileIds: account.professionalProfileIds ?? [],
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
