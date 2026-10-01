// Este arquivo descreve a tabela de contas da aplicação.
// A conta é o vínculo de negócio entre o usuário do SuperTokens e a API.
// O login lê estes campos para montar o contexto colocado na sessão.
// O endpoint /me usa a mesma entidade para devolver dados atuais da conta.

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Representa a conta da aplicação armazenada na tabela `accounts`.
 *
 * O `supertokensUserId` liga a identidade criada pelo SuperTokens
 * ao registro de negócio usado pela API.
 */
@Entity('accounts')
export class Account {
  /** Identificador interno da conta usado nas relações da aplicação. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador do usuário correspondente no SuperTokens. */
  @Column({ name: 'supertokens_user_id', unique: true })
  supertokensUserId: string;

  /** Nome apresentado pelo endpoint `/me`. */
  @Column()
  name: string;

  /** E-mail da conta apresentado pelo endpoint `/me`. */
  @Column()
  email: string;

  /** Perfil de paciente associado; fica nulo quando a conta não é paciente. */
  @Column({ name: 'patient_profile_id', type: 'uuid', nullable: true })
  patientProfileId: string | null;

  /**
   * Perfis profissionais associados à mesma conta.
   * Array vazio significa que a conta não possui perfil profissional.
   */
  @Column({
    name: 'professional_profile_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  professionalProfileIds: string[];
}
