import { ConfigService } from '@nestjs/config';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import dataSource from '../data-source';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';

const TENANT_ID = 'public';
const EMAIL = 'teste@teapts.local';
const PASSWORD = 'teapts123';
const NAME = 'Usuario de Teste';

// A senha fica so no SuperTokens; o seed precisa do core no ar
// (SUPERTOKENS_CONNECTION_URI) alem do Postgres.
// O .env ja foi carregado pelo import de data-source.
function initSupertokens(): void {
  const config = new ConfigService();

  supertokens.init({
    framework: 'express',
    supertokens: {
      connectionURI: config.get(
        'SUPERTOKENS_CONNECTION_URI',
        'http://localhost:3567',
      ),
      apiKey: config.get<string>('SUPERTOKENS_API_KEY') || undefined,
    },
    appInfo: {
      appName: 'TEA-PTS',
      apiDomain: config.get('API_DOMAIN', 'http://localhost:3000'),
      websiteDomain: config.get('WEBSITE_DOMAIN', 'http://localhost:3001'),
      apiBasePath: '/auth',
      websiteBasePath: '/auth',
    },
    recipeList: [EmailPassword.init()],
  });
}

// Cria o usuario no SuperTokens ou reaproveita o existente, para o seed
// poder rodar de novo depois de o banco da aplicacao ser recriado.
async function findOrCreateSupertokensUserId(): Promise<string> {
  const signUp = await EmailPassword.signUp(TENANT_ID, EMAIL, PASSWORD);

  if (signUp.status === 'OK') {
    return signUp.user.id;
  }

  const [existing] = await supertokens.listUsersByAccountInfo(TENANT_ID, {
    email: EMAIL,
  });

  if (!existing) {
    throw new Error(`Nao foi possivel criar ${EMAIL} no SuperTokens`);
  }

  return existing.id;
}

async function createTestUser(): Promise<void> {
  initSupertokens();
  const supertokensUserId = await findOrCreateSupertokensUserId();

  await dataSource.initialize();

  try {
    const accounts = dataSource.getRepository(Account);
    const existing = await accounts.findOneBy({ supertokensUserId });

    if (existing) {
      console.log(`Conta ${EMAIL} ja existe (id ${existing.id}).`);
      return;
    }

    const account = await accounts.save(
      accounts.create({
        name: NAME,
        email: EMAIL,
        supertokensUserId,
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
