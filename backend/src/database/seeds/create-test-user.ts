import { ConfigService } from '@nestjs/config';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import dataSource from '../data-source';
import { Account } from '../../accounts/entities/account.entity';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { Specialism } from '../../professionals/enums/specialism.enum';

const TENANT_ID = 'public';

const TEST_USERS = [
  {
    email: 'teste@teapts.local',
    password: 'teapts123',
    name: 'Usuario de Teste',
    role: AccountRole.Admin,
    profile: 'none',
  },
  {
    email: 'profissional@teapts.local',
    password: 'profissional123',
    name: 'Profissional de Teste',
    role: AccountRole.User,
    profile: 'professional',
  },
  {
    email: 'paciente@teapts.local',
    password: 'paciente123',
    name: 'Paciente de Teste',
    role: AccountRole.User,
    profile: 'patient',
  },
] as const;

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

async function findOrCreateSupertokensUserId(
  email: string,
  password: string,
): Promise<string> {
  const signUp = await EmailPassword.signUp(TENANT_ID, email, password);

  if (signUp.status === 'OK') {
    return signUp.user.id;
  }

  const [existing] = await supertokens.listUsersByAccountInfo(TENANT_ID, {
    email,
  });

  if (!existing) {
    throw new Error(`Nao foi possivel criar ${email} no SuperTokens`);
  }

  return existing.id;
}

async function createOrReuseAccount(
  user: (typeof TEST_USERS)[number],
): Promise<Account> {
  const accounts = dataSource.getRepository(Account);
  const supertokensUserId = await findOrCreateSupertokensUserId(
    user.email,
    user.password,
  );

  let account = await accounts.findOneBy({ supertokensUserId });

  if (!account) {
    account = await accounts.findOneBy({ email: user.email });
  }

  if (account) {
    if (account.supertokensUserId !== supertokensUserId) {
      account.supertokensUserId = supertokensUserId;
    }

    account.name = user.name;
    account.role = user.role;

    account = await accounts.save(account);
    console.log(`Conta reutilizada: ${account.email} (${account.role})`);
    return account;
  }

  account = await accounts.save(
    accounts.create({
      name: user.name,
      email: user.email,
      supertokensUserId,
      role: user.role,
      lastUpdatedAt: null,
    }),
  );

  console.log(`Conta criada: ${account.email} (${account.role})`);
  return account;
}

async function ensureProfessionalProfile(account: Account): Promise<void> {
  const professionals = dataSource.getRepository(Professional);

  const existingProfile = await professionals.findOneBy({
    accountId: account.id,
    specialism: Specialism.Psychologist,
  });

  if (existingProfile) {
    console.log('Perfil profissional de teste ja existe.');
    return;
  }

  const profile = await professionals.save(
    professionals.create({
      accountId: account.id,
      specialism: Specialism.Psychologist,
    }),
  );

  console.log(`Perfil profissional criado: ${profile.id}`);
}

async function ensurePatientProfile(account: Account): Promise<void> {
  const patients = dataSource.getRepository(Patient);

  const existingProfile = await patients.findOneBy({
    accountId: account.id,
  });

  if (existingProfile) {
    console.log('Perfil de paciente de teste ja existe.');
    return;
  }

  await dataSource.query('INSERT INTO "patient" ("accountId") VALUES ($1)', [
    account.id,
  ]);

  console.log(`Perfil de paciente criado: ${account.id}`);
}

async function createTestUsers(): Promise<void> {
  initSupertokens();
  await dataSource.initialize();

  try {
    for (const user of TEST_USERS) {
      const account = await createOrReuseAccount(user);

      if (user.profile === 'professional') {
        await ensureProfessionalProfile(account);
      }

      if (user.profile === 'patient') {
        await ensurePatientProfile(account);
      }

      console.log(`Login de teste: ${user.email}`);
      console.log(`Senha de teste: ${user.password}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void createTestUsers().catch((error: unknown) => {
  console.error('Erro ao criar contas de teste:', error);
  process.exitCode = 1;
});
