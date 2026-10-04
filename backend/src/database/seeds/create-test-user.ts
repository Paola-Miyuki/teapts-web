import { randomBytes, scryptSync } from 'node:crypto';
import dataSource from '../data-source';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';

const EMAIL = 'teste@teapts.local';
const PASSWORD = 'teapts123';
const NAME = 'Usuario de Teste';

// Hash provisorio com scrypt (node:crypto) so para o seed de desenvolvimento.
// A autenticacao de verdade vai usar o SuperTokens.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');

  return `scrypt$${salt}$${derivedKey}`;
}

async function createTestUser(): Promise<void> {
  await dataSource.initialize();

  try {
    const accounts = dataSource.getRepository(Account);
    const existing = await accounts.findOneBy({ email: EMAIL });

    if (existing) {
      console.log(`Conta ${EMAIL} ja existe (id ${existing.id}).`);
      return;
    }

    const account = await accounts.save(
      accounts.create({
        name: NAME,
        email: EMAIL,
        passwordHash: hashPassword(PASSWORD),
        role: AccountRole.Admin,
        lastUpdatedAt: null,
      }),
    );

    console.log(`Conta criada: ${account.email} (id ${account.id})`);
    console.log(`Senha de teste: ${PASSWORD}`);
  } finally {
    await dataSource.destroy();
  }
}

void createTestUser();
