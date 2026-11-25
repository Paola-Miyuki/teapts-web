import { ConfigService } from '@nestjs/config';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import dataSource from '../data-source';
import { Account } from '../../accounts/entities/account.entity';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { Gender } from '../../accounts/enums/gender.enum';
import { Sex } from '../../accounts/enums/sex.enum';
import { DocumentEntity } from '../../documents/entities/document.entity';
import { DocumentCategory } from '../../documents/enums/document-category.enum';
import { Medication } from '../../patients/entities/medication.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { Specialism } from '../../professionals/enums/specialism.enum';
import type { Uf } from '../../professionals/enums/uf.enum';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { StoredObject } from '../../storage/entities/stored-object.entity';
import { PtsStateEnum } from '../enums/pts-state.enum';

const TENANT_ID = 'public';

// Dados pessoais do cadastro (RFAUT001): a conta de admin não tem CPF nem os
// dados obrigatórios da conta de usuário (RN001). CPF, CNS e telefone só com
// dígitos, válidos pelos dígitos verificadores.
const NO_PERSONAL_DATA = {
  socialName: null,
  birthDate: null,
  sex: null,
  gender: null,
  cpf: null,
  phone: null,
};

type ProfessionalSeed = {
  specialism: Specialism;
  councilNumber: string;
  councilState: Uf;
  institution: string | null;
  cnes: string | null;
};

type PatientSeed = {
  cns: string;
  guardianName: string | null;
};

type TestUser = {
  key: string;
  email: string;
  password: string;
  name: string;
  role: AccountRole;
  personal: Pick<
    Account,
    'socialName' | 'birthDate' | 'sex' | 'gender' | 'cpf' | 'phone'
  >;
  professional?: ProfessionalSeed;
  patient?: PatientSeed;
  // Criação da conta (para os filtros de data da tela Contas) e, em `inactive`,
  // a data em que ela foi desativada. Sem `inactive`, a conta fica ativa.
  createdAt?: string;
  inactive?: string;
};

// Contas sem perfil de paciente nem profissional, para testar a tela Contas
// do admin (filtros, "Tornar paciente", "Desativar", conta inativa e a conta
// de administrador, que não recebe perfil). Cada execução do seed devolve a
// situação delas ao que está aqui, então dá para desativar e testar de novo.
const ACCOUNTS_WITHOUT_PROFILE: TestUser[] = [
  {
    key: 'bruno',
    email: 'bruno@teapts.local',
    password: 'conta123',
    name: 'Bruno Takeda',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '1992-02-27',
      sex: Sex.Male,
      gender: null,
      cpf: '39053344705',
      phone: '41991112233',
    },
    createdAt: '2026-11-10T13:00:00.000Z',
  },
  {
    key: 'priscila',
    email: 'priscila@teapts.local',
    password: 'conta123',
    name: 'Priscila Martins',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '1990-05-09',
      sex: Sex.Female,
      gender: Gender.CisWoman,
      cpf: '52998224725',
      phone: '41992223344',
    },
    createdAt: '2026-11-14T13:00:00.000Z',
  },
  {
    key: 'sofia',
    email: 'sofia@teapts.local',
    password: 'conta123',
    name: 'Sofia Andrade',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '1995-08-30',
      sex: Sex.Female,
      gender: null,
      cpf: '16899535009',
      phone: null,
    },
    createdAt: '2026-08-30T13:00:00.000Z',
  },
  {
    // Nome social: a lista mostra e busca pelo nome social.
    key: 'marcela',
    email: 'marcela@teapts.local',
    password: 'conta123',
    name: 'Marcelo Duarte',
    role: AccountRole.User,
    personal: {
      socialName: 'Marcela Duarte',
      birthDate: '1998-10-21',
      sex: Sex.Male,
      gender: Gender.TransWoman,
      cpf: '13579246828',
      phone: '41993334455',
    },
    createdAt: '2026-10-02T13:00:00.000Z',
  },
  {
    // Conta inativa, sem perfil: aparece só com a Situação "Inativa" ou "todas".
    key: 'helena',
    email: 'helena@teapts.local',
    password: 'conta123',
    name: 'Helena Rocha',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '1987-12-04',
      sex: Sex.Female,
      gender: Gender.CisWoman,
      cpf: '24681357928',
      phone: '41994445566',
    },
    createdAt: '2026-04-17T13:00:00.000Z',
    inactive: '2026-09-01T13:00:00.000Z',
  },
  {
    // Segunda conta de administrador: sem CPF nem perfil (RN001, RN002).
    key: 'admin2',
    email: 'maria.admin@teapts.local',
    password: 'teapts123',
    name: 'Maria Santos',
    role: AccountRole.Admin,
    personal: NO_PERSONAL_DATA,
    createdAt: '2026-01-05T13:00:00.000Z',
  },
];

const TEST_USERS: TestUser[] = [
  {
    key: 'admin',
    email: 'teste@teapts.local',
    password: 'teapts123',
    name: 'Usuario de Teste',
    role: AccountRole.Admin,
    personal: NO_PERSONAL_DATA,
  },
  {
    key: 'professional',
    email: 'profissional@teapts.local',
    password: 'profissional123',
    name: 'Profissional de Teste',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '1988-06-12',
      sex: Sex.Female,
      gender: Gender.CisWoman,
      cpf: '12345678909',
      phone: '41991002030',
    },
    // Registro no conselho (CRP, da especialidade), instituição e CNES.
    professional: {
      specialism: Specialism.Psychologist,
      councilNumber: '12345',
      councilState: 'pr',
      institution: 'IMA',
      cnes: '2771112',
    },
  },
  {
    key: 'physiotherapist',
    email: 'fisioterapeuta@teapts.local',
    password: 'profissional123',
    name: 'Beatriz Lopes',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '1985-09-03',
      sex: Sex.Female,
      gender: null,
      cpf: '22233344405',
      phone: '41997001122',
    },
    professional: {
      specialism: Specialism.Physiotherapist,
      councilNumber: '54321',
      councilState: 'pr',
      institution: 'CER Curitiba',
      cnes: null,
    },
  },
  {
    key: 'patient',
    email: 'paciente@teapts.local',
    password: 'paciente123',
    name: 'Paciente de Teste',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '2000-04-18',
      sex: Sex.Male,
      gender: null,
      cpf: '98765432100',
      phone: '41998123344',
    },
    patient: { cns: '700001234567894', guardianName: null },
  },
  {
    key: 'luna',
    email: 'luna@teapts.local',
    password: 'paciente123',
    name: 'Luna Ferreira',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '2007-03-15',
      sex: Sex.Female,
      gender: Gender.CisWoman,
      cpf: '11144477735',
      phone: '41996554433',
    },
    patient: { cns: '700002223334444', guardianName: null },
  },
  {
    key: 'diego',
    email: 'diego@teapts.local',
    password: 'paciente123',
    name: 'Diego Alves',
    role: AccountRole.User,
    personal: {
      socialName: null,
      birthDate: '2015-08-22',
      sex: Sex.Male,
      gender: null,
      cpf: '32165498791',
      phone: null,
    },
    // Menor de 18 anos: tem responsável tutelar.
    patient: { cns: '700005556667777', guardianName: 'Paula Alves' },
  },
];

type PtsSeed = {
  patient: string;
  responsible: string;
  team: string[];
  status: PtsStateEnum;
  socialSituation: string;
  createdAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  beganAt?: string;
  concludedAt?: string;
  cancelledAt?: string;
};

// Um PTS de cada status, para as telas e as regras de acesso (RN016): o
// paciente de teste tem uma proposta aguardando a decisão; Luna tem um PTS
// concluído, uma proposta rejeitada e o PTS em andamento; Diego tem um PTS
// cancelado e o PTS em planejamento, com a fisioterapeuta como responsável.
const TEST_PTS: PtsSeed[] = [
  {
    patient: 'patient',
    responsible: 'professional',
    team: ['physiotherapist'],
    status: PtsStateEnum.DRAFT,
    socialSituation:
      'Mora com os pais; trabalha meio período e faz curso técnico à noite.',
    createdAt: '2026-10-28T13:00:00.000Z',
  },
  {
    patient: 'luna',
    responsible: 'professional',
    team: [],
    status: PtsStateEnum.CONCLUDED,
    socialSituation: 'Mora com a mãe; cursava o ensino médio.',
    createdAt: '2025-09-10T13:00:00.000Z',
    acceptedAt: '2025-09-15T13:00:00.000Z',
    beganAt: '2025-10-01T13:00:00.000Z',
    concludedAt: '2026-05-30T13:00:00.000Z',
  },
  {
    patient: 'luna',
    responsible: 'physiotherapist',
    team: [],
    status: PtsStateEnum.REJECTED,
    socialSituation: 'Mora com a mãe; concluindo o ensino médio.',
    createdAt: '2026-06-10T13:00:00.000Z',
    rejectedAt: '2026-06-15T13:00:00.000Z',
  },
  {
    patient: 'luna',
    responsible: 'professional',
    team: ['physiotherapist'],
    status: PtsStateEnum.RUNNING,
    socialSituation:
      'Mora com a mãe; concluindo o ensino médio e quer fazer curso técnico.',
    createdAt: '2026-07-01T13:00:00.000Z',
    acceptedAt: '2026-07-05T13:00:00.000Z',
    beganAt: '2026-08-01T13:00:00.000Z',
  },
  {
    patient: 'diego',
    responsible: 'professional',
    team: [],
    status: PtsStateEnum.CANCELLED,
    socialSituation: 'Mora com a mãe e a avó; a mãe trabalha à tarde.',
    createdAt: '2026-03-02T13:00:00.000Z',
    acceptedAt: '2026-03-06T13:00:00.000Z',
    cancelledAt: '2026-05-12T13:00:00.000Z',
  },
  {
    patient: 'diego',
    responsible: 'physiotherapist',
    team: ['professional'],
    status: PtsStateEnum.PLANNING,
    socialSituation: 'Mora com a mãe e a avó; a avó busca na escola às terças.',
    createdAt: '2026-10-10T13:00:00.000Z',
    acceptedAt: '2026-10-20T13:00:00.000Z',
  },
];

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

// Devolve a conta à situação do seed: data de criação e ativa ou inativa.
async function applyAccountState(
  account: Account,
  user: TestUser,
): Promise<void> {
  const state = user.inactive
    ? {
        status: AccountStatus.Inactive,
        deactivatedAt: new Date(user.inactive),
        deactivatedByAccountId: null,
      }
    : {
        status: AccountStatus.Active,
        deactivatedAt: null,
        deactivatedByAccountId: null,
      };

  await dataSource.getRepository(Account).update(account.id, {
    ...(user.createdAt ? { createdAt: new Date(user.createdAt) } : {}),
    ...state,
  });
}

async function createOrReuseAccount(user: TestUser): Promise<Account> {
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
    Object.assign(account, user.personal);

    account = await accounts.save(account);
    await applyAccountState(account, user);
    console.log(`Conta reutilizada: ${account.email} (${account.role})`);
    return account;
  }

  account = await accounts.save(
    accounts.create({
      name: user.name,
      email: user.email,
      supertokensUserId,
      role: user.role,
      ...user.personal,
      lastUpdatedAt: null,
    }),
  );

  await applyAccountState(account, user);
  console.log(`Conta criada: ${account.email} (${account.role})`);
  return account;
}

async function ensureProfessionalProfile(
  account: Account,
  data: ProfessionalSeed,
): Promise<Professional> {
  const professionals = dataSource.getRepository(Professional);
  const existing = await professionals.findOneBy({ accountId: account.id });

  if (existing) {
    console.log(`Perfil profissional reutilizado: ${account.email}`);
    return professionals.save(Object.assign(existing, data));
  }

  const profile = await professionals.save(
    professionals.create({ accountId: account.id, ...data }),
  );

  console.log(`Perfil profissional criado: ${account.email}`);
  return profile;
}

async function ensurePatientProfile(
  account: Account,
  data: PatientSeed,
): Promise<void> {
  const patients = dataSource.getRepository(Patient);

  if (await patients.existsBy({ accountId: account.id })) {
    await patients.update({ accountId: account.id }, data);
    console.log(`Perfil de paciente reutilizado: ${account.email}`);
    return;
  }

  await patients.insert({ accountId: account.id, ...data });
  console.log(`Perfil de paciente criado: ${account.email}`);
}

// Cria os PTS de teste do paciente que ainda não tem nenhum PTS; com algum
// PTS, o paciente fica como está, e o seed pode rodar de novo.
async function ensureTestPts(
  patientIds: Map<string, string>,
  professionals: Map<string, Professional>,
): Promise<void> {
  const ptsRepository = dataSource.getRepository(PtsEntity);
  const date = (value?: string) => (value ? new Date(value) : null);

  for (const patientKey of new Set(TEST_PTS.map((pts) => pts.patient))) {
    const patientId = patientIds.get(patientKey)!;

    if (await ptsRepository.existsBy({ patientId })) {
      console.log(`PTS de teste ja existem: ${patientKey}`);
      continue;
    }

    for (const pts of TEST_PTS.filter((item) => item.patient === patientKey)) {
      await ptsRepository.save(
        ptsRepository.create({
          patientId,
          responsibleProfessionalId: professionals.get(pts.responsible)!.id,
          team: pts.team.map((key) => professionals.get(key)!),
          status: pts.status,
          socialSituation: pts.socialSituation,
          createdAt: new Date(pts.createdAt),
          acceptedAt: date(pts.acceptedAt),
          rejectedAt: date(pts.rejectedAt),
          beganAt: date(pts.beganAt),
          concludedAt: date(pts.concludedAt),
          cancelledAt: date(pts.cancelledAt),
        }),
      );
    }

    console.log(`PTS de teste criados: ${patientKey}`);
  }
}

type MedicationSeed = {
  patient: string;
  drugName: string;
  dose: string;
  frequency: string;
  prescriber: string | null;
  reason: string | null;
  startDate: string;
  // Medicação suspensa: a data de término e quem suspendeu (RFPAC007).
  endDate?: string;
  registeredBy: string;
};

// Medicações de uso contínuo (RFPAC007): o paciente de teste e Luna têm
// ativas e uma suspensa; Diego tem uma só. Quem registra é o profissional.
const TEST_MEDICATIONS: MedicationSeed[] = [
  {
    patient: 'patient',
    drugName: 'Risperidona',
    dose: '0,5 mg',
    frequency: '1 vez ao dia, à noite',
    prescriber: 'Dr. Kaio Felipe',
    reason: 'Irritabilidade e agressividade',
    startDate: '2026-03-10',
    registeredBy: 'professional',
  },
  {
    patient: 'patient',
    drugName: 'Melatonina',
    dose: '3 mg',
    frequency: '1 vez ao dia, antes de dormir',
    prescriber: 'Dr. Kaio Felipe',
    reason: 'Dificuldade para dormir',
    startDate: '2026-05-02',
    registeredBy: 'professional',
  },
  {
    patient: 'patient',
    drugName: 'Metilfenidato',
    dose: '10 mg',
    frequency: '1 vez ao dia, pela manhã',
    prescriber: 'Dra. Renata Okada',
    reason: 'Desatenção',
    startDate: '2025-08-15',
    endDate: '2026-02-20',
    registeredBy: 'professional',
  },
  {
    patient: 'luna',
    drugName: 'Sertralina',
    dose: '50 mg',
    frequency: '1 vez ao dia, pela manhã',
    prescriber: 'Dra. Camila Rocha',
    reason: 'Ansiedade',
    startDate: '2026-01-20',
    registeredBy: 'professional',
  },
  {
    patient: 'luna',
    drugName: 'Ácido valproico',
    dose: '250 mg',
    frequency: '2 vezes ao dia',
    prescriber: null,
    reason: null,
    startDate: '2024-11-05',
    endDate: '2025-12-01',
    registeredBy: 'physiotherapist',
  },
  {
    patient: 'diego',
    drugName: 'Aripiprazol',
    dose: '2 mg',
    frequency: '1 vez ao dia, pela manhã',
    prescriber: 'Dr. Kaio Felipe',
    reason: 'Comportamentos repetitivos',
    startDate: '2026-02-12',
    registeredBy: 'professional',
  },
];

type DocumentSeed = {
  patient: string;
  slug: string;
  title: string;
  category: DocumentCategory;
  issueDate: string | null;
  // Conta do profissional emissor, ou o texto de um emissor de fora.
  issuer?: { account: string } | { name: string };
  description: string | null;
  uploadedBy: string;
  createdAt: string;
};

// Documentos de teste (RFDOC002), todos em PDF e já ativos no storage. O
// paciente de teste enviou um dos próprios; os demais vêm do profissional.
const TEST_DOCUMENTS: DocumentSeed[] = [
  {
    patient: 'patient',
    slug: 'laudo-neurologico',
    title: 'Laudo neurológico',
    category: DocumentCategory.MEDICAL_REPORT,
    issueDate: '2026-09-20',
    issuer: {
      name: 'Dra. Marta Reis, CRM-PR 12345, Hospital Pequeno Príncipe',
    },
    description: 'Avaliação neurológica de 2026.',
    uploadedBy: 'professional',
    createdAt: '2026-09-25T13:00:00.000Z',
  },
  {
    patient: 'patient',
    slug: 'relatorio-terapeutico',
    title: 'Relatório terapêutico do semestre',
    category: DocumentCategory.THERAPY_REPORT,
    issueDate: '2026-10-05',
    issuer: { account: 'professional' },
    description: null,
    uploadedBy: 'professional',
    createdAt: '2026-10-06T13:00:00.000Z',
  },
  {
    patient: 'patient',
    slug: 'tcle',
    title: 'TCLE assinado',
    category: DocumentCategory.TCLE,
    issueDate: null,
    description: 'Termo enviado pelo próprio paciente.',
    uploadedBy: 'patient',
    createdAt: '2026-10-08T13:00:00.000Z',
  },
  {
    patient: 'luna',
    slug: 'exame-audiometria',
    title: 'Audiometria',
    category: DocumentCategory.EXAM,
    issueDate: '2026-04-14',
    issuer: { name: 'Clínica Ouvir Bem' },
    description: null,
    uploadedBy: 'professional',
    createdAt: '2026-04-20T13:00:00.000Z',
  },
  {
    patient: 'luna',
    slug: 'relatorio-escolar',
    title: 'Relatório escolar',
    category: DocumentCategory.SCHOOL_REPORT,
    issueDate: '2026-07-01',
    description: 'Entregue pela coordenação da escola.',
    uploadedBy: 'physiotherapist',
    createdAt: '2026-07-10T13:00:00.000Z',
  },
  {
    patient: 'diego',
    slug: 'autorizacao-imagem',
    title: 'Autorização de uso de imagem',
    category: DocumentCategory.IMAGE_AUTHORIZATION,
    issueDate: '2026-03-02',
    description: 'Assinada pela responsável, Paula Alves.',
    uploadedBy: 'professional',
    createdAt: '2026-03-03T13:00:00.000Z',
  },
];

// PDF mínimo e válido, com uma linha de texto, para os documentos de teste.
function minimalPdf(text: string): Buffer {
  const escaped = text.replace(/[\\()]/g, '\\$&');
  const stream = `BT /F1 14 Tf 40 760 Td (${escaped}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = pdf.length;

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

async function ensureTestMedications(
  patientIds: Map<string, string>,
  accountIds: Map<string, string>,
): Promise<void> {
  const medications = dataSource.getRepository(Medication);

  for (const patientKey of new Set(TEST_MEDICATIONS.map((m) => m.patient))) {
    const patientId = patientIds.get(patientKey)!;

    if (await medications.existsBy({ patientId })) {
      console.log(`Medicacoes de teste ja existem: ${patientKey}`);
      continue;
    }

    for (const item of TEST_MEDICATIONS.filter(
      (m) => m.patient === patientKey,
    )) {
      const registeredBy = accountIds.get(item.registeredBy)!;

      await medications.insert({
        patientId,
        drugName: item.drugName,
        dose: item.dose,
        frequency: item.frequency,
        prescriber: item.prescriber,
        reason: item.reason,
        startDate: item.startDate,
        endDate: item.endDate ?? null,
        registeredByAccountId: registeredBy,
        stoppedByAccountId: item.endDate ? registeredBy : null,
      });
    }

    console.log(`Medicacoes de teste criadas: ${patientKey}`);
  }
}

// Cria os documentos de teste que ainda não existem (pela `file_key`, que é
// fixa): o arquivo entra ativo em `stored_object` e o registro em `document`.
async function ensureTestDocuments(
  patientIds: Map<string, string>,
  accountIds: Map<string, string>,
): Promise<void> {
  const documents = dataSource.getRepository(DocumentEntity);

  for (const item of TEST_DOCUMENTS) {
    const patientId = patientIds.get(item.patient)!;
    const fileKey = `${patientId}/seed-${item.slug}.pdf`;

    if (await documents.existsBy({ fileKey })) {
      console.log(`Documento de teste ja existe: ${fileKey}`);
      continue;
    }

    const content = minimalPdf(item.title);

    await dataSource.transaction(async (manager) => {
      await manager.getRepository(StoredObject).upsert(
        {
          fileKey,
          mimeType: 'application/pdf',
          sizeBytes: content.length,
          content,
          active: true,
        },
        ['fileKey'],
      );
      await manager.getRepository(DocumentEntity).insert({
        patientId,
        title: item.title,
        description: item.description,
        category: item.category,
        issueDate: item.issueDate,
        issuerAccountId:
          item.issuer && 'account' in item.issuer
            ? accountIds.get(item.issuer.account)!
            : null,
        issuerName:
          item.issuer && 'name' in item.issuer ? item.issuer.name : null,
        fileKey,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        uploadedByAccountId: accountIds.get(item.uploadedBy)!,
        createdAt: new Date(item.createdAt),
      });
    });

    console.log(`Documento de teste criado: ${fileKey}`);
  }
}

async function createTestUsers(): Promise<void> {
  initSupertokens();
  await dataSource.initialize();

  try {
    const patientIds = new Map<string, string>();
    const professionals = new Map<string, Professional>();
    const accountIds = new Map<string, string>();

    for (const user of [...TEST_USERS, ...ACCOUNTS_WITHOUT_PROFILE]) {
      const account = await createOrReuseAccount(user);

      accountIds.set(user.key, account.id);

      if (user.professional) {
        professionals.set(
          user.key,
          await ensureProfessionalProfile(account, user.professional),
        );
      }

      if (user.patient) {
        await ensurePatientProfile(account, user.patient);
        patientIds.set(user.key, account.id);
      }

      console.log(`Login de teste: ${user.email} / ${user.password}`);
    }

    await ensureTestPts(patientIds, professionals);
    await ensureTestMedications(patientIds, accountIds);
    await ensureTestDocuments(patientIds, accountIds);
  } finally {
    await dataSource.destroy();
  }
}

void createTestUsers().catch((error: unknown) => {
  console.error('Erro ao criar contas de teste:', error);
  process.exitCode = 1;
});
