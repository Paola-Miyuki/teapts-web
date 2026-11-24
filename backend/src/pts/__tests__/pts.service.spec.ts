import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { PtsService } from '../services/pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';

const body = {
  professionalId: 'prof-10',
  patientId: 'patient-25',
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: ['prof-11', 'prof-15'],
};

const patientAccount: AccountContext = {
  accountId: 'acc-patient-25',
  role: AccountRole.User,
  patientProfileId: 'acc-patient-25',
  professionalProfileIds: [],
};

const otherPatientAccount: AccountContext = {
  accountId: 'acc-patient-30',
  role: AccountRole.User,
  patientProfileId: 'acc-patient-30',
  professionalProfileIds: [],
};

const responsibleAccount: AccountContext = {
  accountId: 'acc-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['prof-10'],
};

const teamAccount: AccountContext = {
  accountId: 'acc-2',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['prof-11'],
};

const otherProfessionalAccount: AccountContext = {
  accountId: 'acc-9',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['prof-20'],
};

// Conta com perfil de paciente (de outra pessoa) e perfil profissional (RN002).
const patientAndTeamAccount: AccountContext = {
  accountId: 'acc-2',
  role: AccountRole.User,
  patientProfileId: 'acc-patient-30',
  professionalProfileIds: ['prof-11'],
};

const noProfileAccount: AccountContext = {
  accountId: 'acc-none',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
};

const adminAccount: AccountContext = {
  accountId: 'acc-admin',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};

const accountOf = (accountId: string): AccountContext => ({
  accountId,
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
});

describe('PtsService.createPts', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  it('cria uma proposta com responsável, paciente e equipe', async () => {
    const result = await service.createPts(body, accountOf('acc-1'));

    expect(result).toMatchObject({
      id: '100',
      status: PtsStateEnum.DRAFT,
      patient: { id: 'patient-25' },
      responsible: { id: 'prof-10' },
      team: [{ id: 'prof-11' }, { id: 'prof-15' }],
    });
  });

  it('rejeita quando a sessão não pertence ao profissional responsável', async () => {
    await expectApiError(
      () => service.createPts(body, accountOf('acc-9')),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );

    expect(repo.created).toHaveLength(0);
  });

  it('rejeita quando o paciente não existe', async () => {
    await expectApiError(
      () =>
        service.createPts(
          { ...body, patientId: 'patient-404' },
          accountOf('acc-1'),
        ),
      404,
      'PATIENT_NOT_FOUND',
    );
  });

  it('rejeita quando já existe PTS aprovado e ativo', async () => {
    repo.patientsWithApprovedActivePts.add('patient-25');

    await expectApiError(
      () => service.createPts(body, accountOf('acc-1')),
      409,
      'PTS_ACTIVE_EXISTS',
    );
  });

  it('aceita equipe omitida e retorna lista vazia', async () => {
    const withoutTeam = {
      professionalId: body.professionalId,
      patientId: body.patientId,
      socialSituation: body.socialSituation,
    };

    const result = await service.createPts(withoutTeam, accountOf('acc-1'));

    expect(result.team).toEqual([]);
  });

  it('remove IDs duplicados e o responsável da equipe', async () => {
    const result = await service.createPts(
      {
        ...body,
        teamProfessionalIds: ['prof-11', 'prof-11', 'prof-10'],
      },
      accountOf('acc-1'),
    );

    expect(result.team.map((professional) => professional.id)).toEqual([
      'prof-11',
    ]);
  });

  it('não é bloqueado por PTS ativo de outro paciente', async () => {
    repo.patients.add('patient-26');
    repo.patientsWithApprovedActivePts.add('patient-26');

    await expect(
      service.createPts(body, accountOf('acc-1')),
    ).resolves.toMatchObject({
      patient: { id: 'patient-25' },
    });
  });

  it('trata profissional inexistente como não autorizado', async () => {
    await expectApiError(
      () =>
        service.createPts(
          { ...body, professionalId: 'prof-999' },
          accountOf('acc-1'),
        ),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );
  });

  it('verifica a autorização antes de revelar se o paciente existe', async () => {
    await expectApiError(
      () =>
        service.createPts(
          {
            ...body,
            professionalId: 'prof-20',
            patientId: 'patient-inexistente',
          },
          accountOf('acc-1'),
        ),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );
  });

  it('rejeita o profissional quando a sessão pertence a outra conta', async () => {
    await expectApiError(
      () => service.createPts(body, accountOf('acc-2')),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );
  });

  it('rejeita profissionais inexistentes na equipe', async () => {
    const result = await expectApiError(
      () =>
        service.createPts(
          {
            ...body,
            teamProfessionalIds: ['prof-11', 'prof-777', 'prof-888'],
          },
          accountOf('acc-1'),
        ),
      400,
      'TEAM_PROFESSIONAL_NOT_FOUND',
    );

    expect(result.professionalIds).toEqual(['prof-777', 'prof-888']);
    expect(repo.created).toHaveLength(0);
  });
});

describe('PtsService.findDraftProposals', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  it('retorna propostas e dados de paginação para o paciente', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      patientAccount,
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('socialSituation');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('permite que o profissional responsável consulte as propostas', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      responsibleAccount,
    );

    expect(result.data).toHaveLength(1);
  });

  it('permite que um integrante da equipe consulte as propostas', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      teamAccount,
    );

    expect(result.data).toHaveLength(1);
  });

  it('rejeita profissional sem vínculo com o paciente', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () =>
        service.findDraftProposals(
          { patientId: 'acc-patient-25', page: 1, limit: 20 },
          otherProfessionalAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('sem paciente, lista as propostas de que o profissional faz parte', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposals({ page: 1, limit: 20 }, responsibleAccount),
    ).resolves.toMatchObject({ pagination: { total: 1 } });
    await expect(
      service.findDraftProposals(
        { page: 1, limit: 20 },
        otherProfessionalAccount,
      ),
    ).resolves.toMatchObject({ data: [], pagination: { total: 0 } });
  });

  it('sem paciente, o admin vê todas e o paciente só as próprias', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';
    const other = await service.createPts(body, accountOf('acc-1'));
    other.patient.id = 'acc-patient-99';

    await expect(
      service.findDraftProposals({ page: 1, limit: 20 }, adminAccount),
    ).resolves.toMatchObject({ pagination: { total: 2 } });
    await expect(
      service.findDraftProposals({ page: 1, limit: 20 }, patientAccount),
    ).resolves.toMatchObject({
      data: [{ patient: { id: 'acc-patient-25' } }],
      pagination: { total: 1 },
    });
  });

  it('filtra pelo nome do paciente', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.name = 'Luna Ferreira';

    await expect(
      service.findDraftProposals(
        { q: 'luna', page: 1, limit: 20 },
        adminAccount,
      ),
    ).resolves.toMatchObject({ pagination: { total: 1 } });
    await expect(
      service.findDraftProposals(
        { q: 'pedro', page: 1, limit: 20 },
        adminAccount,
      ),
    ).resolves.toMatchObject({ pagination: { total: 0 } });
  });

  it('retorna lista vazia quando o paciente não tem propostas', async () => {
    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      patientAccount,
    );

    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('retorna somente propostas vinculadas ao profissional', async () => {
    const primeiraProposta = await service.createPts(body, accountOf('acc-1'));
    primeiraProposta.patient.id = 'acc-patient-25';

    const segundaProposta = await service.createPts(
      {
        ...body,
        professionalId: 'prof-11',
        teamProfessionalIds: ['prof-15'],
      },
      accountOf('acc-2'),
    );
    segundaProposta.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      responsibleAccount,
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(primeiraProposta.id);
    expect(result.pagination.total).toBe(1);
  });

  it('retorna lista vazia quando o profissional tem vínculo, mas não há propostas DRAFT disponíveis', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';
    proposal.status = PtsStateEnum.CONCLUDED;

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      responsibleAccount,
    );

    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  // NOVO
  it('rejeita conta sem perfil de paciente nem profissional', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () =>
        service.findDraftProposals(
          { patientId: 'acc-patient-25', page: 1, limit: 20 },
          noProfileAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  // NOVO
  it('rejeita paciente que consulta propostas de outro paciente', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () =>
        service.findDraftProposals(
          { patientId: 'acc-patient-25', page: 1, limit: 20 },
          otherPatientAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  // NOVO
  it('permite que conta com perfis de paciente e profissional consulte como profissional', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      patientAndTeamAccount,
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(proposal.id);
  });

  // NOVO
  it('pagina os resultados e calcula o total de páginas', async () => {
    const first = await service.createPts(body, accountOf('acc-1'));
    first.patient.id = 'acc-patient-25';
    const second = await service.createPts(body, accountOf('acc-1'));
    second.patient.id = 'acc-patient-25';

    const page1 = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 1 },
      patientAccount,
    );
    const page2 = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 2, limit: 1 },
      patientAccount,
    );

    expect(page1.data.map((p) => p.id)).toEqual([second.id]);
    expect(page2.data.map((p) => p.id)).toEqual([first.id]);
    expect(page1.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });
});

describe('PtsService.findActivePts', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  const activePts: ActivePtsResponseDto = {
    id: 'active-100',
    status: PtsStateEnum.PLANNING,
    socialSituation: 'Situação social confidencial.',
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum confidencial.',
    cid: 'F84.0',
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação'],
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: '2026-10-15T12:30:00.000Z',
    beganAt: null,
    patient: { id: 'acc-patient-25', name: 'Priscila Martins' },
    responsible: {
      id: 'prof-10',
      name: 'Profissional responsável',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
    team: [
      {
        id: 'prof-11',
        name: 'Profissional da equipe',
        specialism: { id: 'doctor', name: 'Medicina' },
        registration: null,
      },
    ],
  };

  beforeEach(() => {
    repo = seededRepo();
    repo.activePts.push(activePts);
    service = new PtsService(repo);
  });

  it('retorna o PTS sem a ficha, só com a próxima revisão, para o paciente titular', async () => {
    const result = await service.findActivePts(
      { patientId: 'acc-patient-25' },
      patientAccount,
    );

    expect(result).toMatchObject({
      id: 'active-100',
      status: PtsStateEnum.PLANNING,
      acceptedAt: activePts.acceptedAt,
      beganAt: null,
    });
    expect(result).not.toHaveProperty('socialSituation');
    expect(result).not.toHaveProperty('diagnosisSummary');
    expect(result).not.toHaveProperty('cid');
    expect(result).not.toHaveProperty('priorityNeeds');
    expect(result.nextReviewAt).toBe('2027-10-01');
  });

  it('retorna o PTS completo para o responsável', async () => {
    await expect(
      service.findActivePts(
        { patientId: 'acc-patient-25' },
        responsibleAccount,
      ),
    ).resolves.toMatchObject({
      socialSituation: activePts.socialSituation,
      responsible: { id: 'prof-10' },
      team: [{ id: 'prof-11' }],
    });
  });

  it('retorna o PTS completo para um integrante da equipe', async () => {
    await expect(
      service.findActivePts({ patientId: 'acc-patient-25' }, teamAccount),
    ).resolves.toMatchObject({ id: 'active-100' });
  });

  it('rejeita profissional sem vínculo', async () => {
    await expectApiError(
      () =>
        service.findActivePts(
          { patientId: 'acc-patient-25' },
          otherProfessionalAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('rejeita conta sem perfil antes de consultar o PTS', async () => {
    await expectApiError(
      () =>
        service.findActivePts(
          { patientId: 'acc-patient-25' },
          noProfileAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('rejeita paciente que consulta outro paciente', async () => {
    await expectApiError(
      () =>
        service.findActivePts(
          { patientId: 'acc-patient-25' },
          otherPatientAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('retorna 404 quando não existe PTS ativo para o paciente titular', async () => {
    repo.activePts.length = 0;

    await expectApiError(
      () =>
        service.findActivePts({ patientId: 'acc-patient-25' }, patientAccount),
      404,
      'ACTIVE_PTS_NOT_FOUND',
    );
  });
});

describe('PtsService.updatePtsProposal', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  const createDraft = async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';
    return proposal;
  };

  it('permite ao responsável editar a situação social e a equipe', async () => {
    const proposal = await createDraft();

    const result = await service.updatePtsProposal(
      proposal.id,
      {
        socialSituation: 'Situação social atualizada.',
        teamProfessionalIds: ['prof-11', 'prof-11', 'prof-10'],
      },
      responsibleAccount,
    );

    expect(result).toMatchObject({
      id: proposal.id,
      status: PtsStateEnum.DRAFT,
      socialSituation: 'Situação social atualizada.',
      team: [{ id: 'prof-11' }],
    });
  });

  it('permite editar somente a situação social', async () => {
    const proposal = await createDraft();

    const result = await service.updatePtsProposal(
      proposal.id,
      { socialSituation: 'Nova situação social.' },
      responsibleAccount,
    );

    expect(result.socialSituation).toBe('Nova situação social.');
    expect(result.team).toHaveLength(2);
  });

  it('permite substituir a equipe por uma lista vazia', async () => {
    const proposal = await createDraft();

    const result = await service.updatePtsProposal(
      proposal.id,
      { teamProfessionalIds: [] },
      responsibleAccount,
    );

    expect(result.team).toEqual([]);
  });

  it('rejeita edição por integrante da equipe', async () => {
    const proposal = await createDraft();

    await expectApiError(
      () =>
        service.updatePtsProposal(
          proposal.id,
          { socialSituation: 'Alteração indevida.' },
          teamAccount,
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('rejeita edição de proposta que não está em DRAFT', async () => {
    const proposal = await createDraft();
    proposal.status = PtsStateEnum.PLANNING;

    await expectApiError(
      () =>
        service.updatePtsProposal(
          proposal.id,
          { socialSituation: 'Não deve alterar.' },
          responsibleAccount,
        ),
      409,
      'PTS_NOT_DRAFT',
    );
  });

  it('rejeita profissional inexistente na equipe', async () => {
    const proposal = await createDraft();

    const response = await expectApiError(
      () =>
        service.updatePtsProposal(
          proposal.id,
          { teamProfessionalIds: ['prof-404'] },
          responsibleAccount,
        ),
      400,
      'TEAM_PROFESSIONAL_NOT_FOUND',
    );

    expect(response.professionalIds).toEqual(['prof-404']);
  });

  it('rejeita edição sem nenhum campo', async () => {
    const proposal = await createDraft();

    await expectApiError(
      () => service.updatePtsProposal(proposal.id, {}, responsibleAccount),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('retorna 404 quando a proposta não existe', async () => {
    await expectApiError(
      () =>
        service.updatePtsProposal(
          'proposal-404',
          { socialSituation: 'Nova situação.' },
          responsibleAccount,
        ),
      404,
      'PTS_NOT_FOUND',
    );
  });
});

describe('PtsService.updatePtsSheet', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  const sheet = {
    caseStudyDate: '2026-10-01',
    diagnosisSummary: '  Diagnóstico em comum atualizado.  ',
    cid: ' F84.0 ',
    supportLevel: 2,
    strengths: '',
    priorityNeeds: ['Comunicação', '  ', ' Autonomia '],
    socialSituation: ' Situação social atualizada. ',
    vulnerabilities: null,
    comorbidities: 'TDAH',
    sensoryProfile: undefined,
    communicationMethod: '   ',
    nextReviewAt: '2027-10-01',
  };

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
    repo.sheetTargets.set('pts-100', {
      id: 'pts-100',
      status: PtsStateEnum.PLANNING,
      responsibleProfessionalId: 'prof-10',
      teamProfessionalIds: ['prof-11'],
    });
  });

  it('permite ao responsável atualizar a ficha, aparada e com opcional vazio como null', async () => {
    await expect(
      service.updatePtsSheet('pts-100', sheet, responsibleAccount),
    ).resolves.toEqual({
      id: 'pts-100',
      caseStudyDate: '2026-10-01',
      diagnosisSummary: 'Diagnóstico em comum atualizado.',
      cid: 'F84.0',
      supportLevel: 2,
      strengths: null,
      priorityNeeds: ['Comunicação', 'Autonomia'],
      socialSituation: 'Situação social atualizada.',
      vulnerabilities: null,
      comorbidities: 'TDAH',
      sensoryProfile: null,
      communicationMethod: null,
      nextReviewAt: '2027-10-01',
    });
  });

  it('grava pts_updated com o profissional e a conta que executaram', async () => {
    await service.updatePtsSheet('pts-100', sheet, teamAccount);

    expect(repo.sheetUpdates).toHaveLength(1);
    expect(repo.sheetUpdates[0]).toMatchObject({
      ptsId: 'pts-100',
      authorProfessionalId: 'prof-11',
      executedByAccountId: teamAccount.accountId,
      description: 'Ficha do PTS atualizada.',
    });
  });

  it('permite ao admin, sem autor profissional no evento (RN029)', async () => {
    await expect(
      service.updatePtsSheet('pts-100', sheet, adminAccount),
    ).resolves.toMatchObject({ id: 'pts-100' });

    expect(repo.sheetUpdates[0]).toMatchObject({
      authorProfessionalId: null,
      executedByAccountId: adminAccount.accountId,
    });
  });

  it('rejeita profissional sem vínculo com o PTS', async () => {
    await expectApiError(
      () => service.updatePtsSheet('pts-100', sheet, otherProfessionalAccount),
      403,
      'FORBIDDEN',
    );
    expect(repo.sheetUpdates).toHaveLength(0);
  });

  it('rejeita o paciente', async () => {
    await expectApiError(
      () => service.updatePtsSheet('pts-100', sheet, patientAccount),
      403,
      'FORBIDDEN',
    );
  });

  it.each([
    PtsStateEnum.DRAFT,
    PtsStateEnum.REJECTED,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
  ])('rejeita PTS em %s', async (status) => {
    repo.sheetTargets.get('pts-100')!.status = status;

    await expectApiError(
      () => service.updatePtsSheet('pts-100', sheet, responsibleAccount),
      409,
      'PTS_NOT_ACTIVE',
    );
  });

  it.each(['diagnosisSummary', 'socialSituation'] as const)(
    'rejeita %s vazio ou só com espaços',
    async (field) => {
      await expectApiError(
        () =>
          service.updatePtsSheet(
            'pts-100',
            { ...sheet, [field]: '   ' },
            responsibleAccount,
          ),
        400,
        'VALIDATION_ERROR',
      );
    },
  );

  it('retorna 404 quando o PTS não existe', async () => {
    await expectApiError(
      () => service.updatePtsSheet('pts-404', sheet, responsibleAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });
});

describe('PtsService.findDraftProposalById', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  it('permite que o paciente consulte sua própria proposta', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, patientAccount),
    ).resolves.toMatchObject({
      id: proposal.id,
      status: PtsStateEnum.DRAFT,
    });
  });

  it('permite que o profissional responsável consulte a proposta', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, responsibleAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('permite que um integrante da equipe consulte a proposta', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, teamAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('rejeita profissional sem vínculo com a proposta', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () =>
        service.findDraftProposalById(proposal.id, otherProfessionalAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('retorna 404 quando a proposta não existe', async () => {
    await expectApiError(
      () => service.findDraftProposalById('inexistente', responsibleAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it('permite que conta com perfis de paciente e profissional consulte como integrante da equipe', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, patientAndTeamAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('rejeita paciente que consulta proposta de outro paciente', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, otherPatientAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('rejeita conta sem perfil de paciente nem profissional', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, noProfileAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('retorna 404 quando a proposta não está mais em DRAFT', async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';
    proposal.status = PtsStateEnum.CONCLUDED;

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, patientAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });
});

describe('PtsService.approveProposal', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  const createDraft = async (patientId = 'acc-patient-25') => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = patientId;
    return proposal;
  };

  it('aprova a proposta e rejeita os demais DRAFT do paciente', async () => {
    const chosen = await createDraft();
    const other = await createDraft();
    const otherPatientDraft = await createDraft('acc-patient-30');

    const result = await service.approveProposal(chosen.id, patientAccount);

    expect(result).toMatchObject({
      id: chosen.id,
      status: PtsStateEnum.PLANNING,
      rejectedAt: null,
    });
    expect(result.acceptedAt).toEqual(expect.any(String));
    expect(chosen.status).toBe(PtsStateEnum.PLANNING);
    expect(other.status).toBe(PtsStateEnum.REJECTED);
    expect(otherPatientDraft.status).toBe(PtsStateEnum.DRAFT);
  });

  it('retorna 404 quando a proposta não existe', async () => {
    await expectApiError(
      () => service.approveProposal('missing', patientAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it('nega a proposta de outro paciente', async () => {
    const proposal = await createDraft();

    await expectApiError(
      () => service.approveProposal(proposal.id, otherPatientAccount),
      403,
      'FORBIDDEN',
    );
    expect(proposal.status).toBe(PtsStateEnum.DRAFT);
  });

  it('nega conta sem perfil de paciente, mesmo o responsável', async () => {
    const proposal = await createDraft();

    await expectApiError(
      () => service.approveProposal(proposal.id, responsibleAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('não decide proposta fora de DRAFT', async () => {
    const proposal = await createDraft();
    proposal.status = PtsStateEnum.REJECTED;

    const response = await expectApiError(
      () => service.approveProposal(proposal.id, patientAccount),
      409,
      'PTS_NOT_DRAFT',
    );
    expect(response.message).toBe(
      'A proposta não está mais aguardando decisão.',
    );
  });

  it('não aprova quando o paciente já tem PTS ativo', async () => {
    const proposal = await createDraft();
    repo.patientsWithApprovedActivePts.add('acc-patient-25');

    await expectApiError(
      () => service.approveProposal(proposal.id, patientAccount),
      409,
      'ACTIVE_PTS_ALREADY_EXISTS',
    );
    expect(proposal.status).toBe(PtsStateEnum.DRAFT);
  });
});

describe('PtsService.rejectProposal', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  const createDraft = async () => {
    const proposal = await service.createPts(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';
    return proposal;
  };

  it('rejeita só a proposta escolhida', async () => {
    const chosen = await createDraft();
    const other = await createDraft();

    const result = await service.rejectProposal(chosen.id, patientAccount);

    expect(result).toMatchObject({
      id: chosen.id,
      status: PtsStateEnum.REJECTED,
      acceptedAt: null,
    });
    expect(result.rejectedAt).toEqual(expect.any(String));
    expect(chosen.status).toBe(PtsStateEnum.REJECTED);
    expect(other.status).toBe(PtsStateEnum.DRAFT);
  });

  it('nega a proposta de outro paciente', async () => {
    const proposal = await createDraft();

    await expectApiError(
      () => service.rejectProposal(proposal.id, otherPatientAccount),
      403,
      'FORBIDDEN',
    );
    expect(proposal.status).toBe(PtsStateEnum.DRAFT);
  });

  it('não decide proposta fora de DRAFT', async () => {
    const proposal = await createDraft();
    proposal.status = PtsStateEnum.PLANNING;

    await expectApiError(
      () => service.rejectProposal(proposal.id, patientAccount),
      409,
      'PTS_NOT_DRAFT',
    );
    expect(proposal.status).toBe(PtsStateEnum.PLANNING);
  });
});

describe('PtsService com administrador (RN022)', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  const activePts: ActivePtsResponseDto = {
    id: 'active-100',
    status: PtsStateEnum.PLANNING,
    socialSituation: 'Situação social confidencial.',
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum confidencial.',
    cid: 'F84.0',
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação'],
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: '2026-10-15T12:30:00.000Z',
    beganAt: null,
    patient: { id: 'acc-patient-25', name: 'Priscila Martins' },
    responsible: {
      id: 'prof-10',
      name: 'Profissional responsável',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
    team: [],
  };

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  const createDraft = async () => {
    const proposal = await service.createPts(body, adminAccount);
    proposal.patient.id = 'acc-patient-25';
    return proposal;
  };

  it('cria a proposta com o profissional escolhido como responsável', async () => {
    const result = await service.createPts(body, adminAccount);

    expect(result).toMatchObject({
      status: PtsStateEnum.DRAFT,
      responsible: { id: 'prof-10' },
    });
  });

  it('mantém 403 para profissional inexistente na criação', async () => {
    await expectApiError(
      () =>
        service.createPts(
          { ...body, professionalId: 'prof-999' },
          adminAccount,
        ),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );
  });

  it('mantém as regras de criação para o admin', async () => {
    repo.patientsWithApprovedActivePts.add('patient-25');

    await expectApiError(
      () => service.createPts(body, adminAccount),
      409,
      'PTS_ACTIVE_EXISTS',
    );
  });

  it('lista as propostas de qualquer paciente, sem relação com a equipe', async () => {
    await createDraft();

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      adminAccount,
    );

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('lista vazio, sem 403, quando o paciente não tem proposta', async () => {
    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      adminAccount,
    );

    expect(result.data).toEqual([]);
  });

  it('detalha a proposta', async () => {
    const proposal = await createDraft();

    await expect(
      service.findDraftProposalById(proposal.id, adminAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('retorna o PTS ativo com a situação social', async () => {
    repo.activePts.push(activePts);

    await expect(
      service.findActivePts({ patientId: 'acc-patient-25' }, adminAccount),
    ).resolves.toMatchObject({
      id: 'active-100',
      socialSituation: activePts.socialSituation,
    });
  });

  it('retorna 404 quando não há PTS ativo', async () => {
    await expectApiError(
      () =>
        service.findActivePts({ patientId: 'acc-patient-25' }, adminAccount),
      404,
      'ACTIVE_PTS_NOT_FOUND',
    );
  });

  it('edita a proposta em DRAFT', async () => {
    const proposal = await createDraft();

    await expect(
      service.updatePtsProposal(
        proposal.id,
        { socialSituation: 'Situação social atualizada.' },
        adminAccount,
      ),
    ).resolves.toMatchObject({
      socialSituation: 'Situação social atualizada.',
    });
  });

  it('não edita proposta fora de DRAFT', async () => {
    const proposal = await createDraft();
    proposal.status = PtsStateEnum.PLANNING;

    await expectApiError(
      () =>
        service.updatePtsProposal(
          proposal.id,
          { socialSituation: 'Nova.' },
          adminAccount,
        ),
      409,
      'PTS_NOT_DRAFT',
    );
  });

  it('aprova a proposta em nome do paciente', async () => {
    const proposal = await createDraft();

    await expect(
      service.approveProposal(proposal.id, adminAccount),
    ).resolves.toMatchObject({
      id: proposal.id,
      status: PtsStateEnum.PLANNING,
    });
  });

  it('rejeita a proposta em nome do paciente', async () => {
    const proposal = await createDraft();

    await expect(
      service.rejectProposal(proposal.id, adminAccount),
    ).resolves.toMatchObject({
      id: proposal.id,
      status: PtsStateEnum.REJECTED,
    });
  });

  it('não decide proposta fora de DRAFT', async () => {
    const proposal = await createDraft();
    proposal.status = PtsStateEnum.PLANNING;

    await expectApiError(
      () => service.approveProposal(proposal.id, adminAccount),
      409,
      'PTS_NOT_DRAFT',
    );
  });
});

describe('PtsService.findPtsById', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  const concludedPts: PtsDetailResponseDto = {
    id: 'pts-old',
    status: PtsStateEnum.CONCLUDED,
    socialSituation: 'Situação social confidencial.',
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum confidencial.',
    cid: 'F84.0',
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação'],
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
    createdAt: '2026-01-10T12:00:00.000Z',
    acceptedAt: '2026-01-11T12:00:00.000Z',
    rejectedAt: null,
    beganAt: '2026-01-12T12:00:00.000Z',
    concludedAt: '2026-07-10T12:00:00.000Z',
    cancelledAt: null,
    patient: { id: 'acc-patient-25', name: 'Priscila Martins' },
    responsible: {
      id: 'prof-10',
      name: 'Profissional responsável',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
    team: [
      {
        id: 'prof-11',
        name: 'Profissional da equipe',
        specialism: { id: 'doctor', name: 'Medicina' },
        registration: null,
      },
    ],
  };

  beforeEach(() => {
    repo = seededRepo();
    repo.ptsById.set(concludedPts.id, concludedPts);
    repo.ptsById.set('pts-rejected', {
      ...concludedPts,
      id: 'pts-rejected',
      status: PtsStateEnum.REJECTED,
      concludedAt: null,
      rejectedAt: '2026-01-11T12:00:00.000Z',
    });
    service = new PtsService(repo);
  });

  it('returns a closed PTS to a team member (RN016)', async () => {
    await expect(
      service.findPtsById('pts-old', teamAccount),
    ).resolves.toMatchObject({
      status: PtsStateEnum.CONCLUDED,
      concludedAt: concludedPts.concludedAt,
      socialSituation: concludedPts.socialSituation,
    });
  });

  it('returns the own old PTS to the patient without the social situation (RN028)', async () => {
    const result = await service.findPtsById('pts-old', patientAccount);

    expect(result).toMatchObject({ id: 'pts-old' });
    expect(result).not.toHaveProperty('socialSituation');
  });

  it('returns any PTS to the admin', async () => {
    await expect(
      service.findPtsById('pts-rejected', adminAccount),
    ).resolves.toMatchObject({ status: PtsStateEnum.REJECTED });
  });

  it('answers 403 to a team member of a rejected PTS', async () => {
    await expectApiError(
      () => service.findPtsById('pts-rejected', teamAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('answers 403 to a professional outside the team and to another patient', async () => {
    await expectApiError(
      () => service.findPtsById('pts-old', otherProfessionalAccount),
      403,
      'FORBIDDEN',
    );
    await expectApiError(
      () => service.findPtsById('pts-old', otherPatientAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('answers 404 PTS_NOT_FOUND for a missing PTS', async () => {
    await expectApiError(
      () => service.findPtsById('missing', adminAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });
});

describe('PtsService.deleteProposal', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  const createDraft = () => service.createPts(body, responsibleAccount);

  it('exclui a proposta em DRAFT e responde { status: OK }', async () => {
    const proposal = await createDraft();

    await expect(
      service.deleteProposal(proposal.id, responsibleAccount),
    ).resolves.toEqual({ status: 'OK' });
    expect(repo.deletedIds.has(proposal.id)).toBe(true);
  });

  it('é lógica: a proposta continua guardada com a equipe', async () => {
    const proposal = await createDraft();

    await service.deleteProposal(proposal.id, responsibleAccount);

    expect(repo.created).toContainEqual(
      expect.objectContaining({
        id: proposal.id,
        team: expect.arrayContaining([
          expect.objectContaining({ id: 'prof-11' }),
        ]),
      }),
    );
  });

  it('a proposta excluída some de GET /pts/proposals', async () => {
    const proposal = await createDraft();

    await service.deleteProposal(proposal.id, responsibleAccount);

    const result = await service.findDraftProposals(
      { patientId: 'patient-25', page: 1, limit: 20 },
      adminAccount,
    );
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('a proposta excluída responde 404 em GET /pts/proposals/:id', async () => {
    const proposal = await createDraft();

    await service.deleteProposal(proposal.id, responsibleAccount);

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, responsibleAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it('excluir de novo responde 404 PTS_NOT_FOUND', async () => {
    const proposal = await createDraft();
    await service.deleteProposal(proposal.id, responsibleAccount);

    await expectApiError(
      () => service.deleteProposal(proposal.id, responsibleAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it('a proposta excluída não pode mais ser aprovada', async () => {
    const proposal = await createDraft();
    await service.deleteProposal(proposal.id, responsibleAccount);

    await expectApiError(
      () => service.approveProposal(proposal.id, adminAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it('responde 404 PTS_NOT_FOUND para proposta inexistente', async () => {
    await expectApiError(
      () => service.deleteProposal('999', responsibleAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it.each([
    ['membro da equipe', teamAccount],
    ['outro profissional', otherProfessionalAccount],
    ['paciente', patientAccount],
    ['conta sem perfil', noProfileAccount],
  ])('responde 403 para %s', async (_label, account) => {
    const proposal = await createDraft();

    await expectApiError(
      () => service.deleteProposal(proposal.id, account),
      403,
      'FORBIDDEN',
    );
    expect(repo.deletedIds.size).toBe(0);
  });

  it.each([
    PtsStateEnum.PLANNING,
    PtsStateEnum.RUNNING,
    PtsStateEnum.REJECTED,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
  ])('responde 409 PTS_NOT_DRAFT para proposta em %s', async (status) => {
    const proposal = await createDraft();
    proposal.status = status;

    const error = await expectApiError(
      () => service.deleteProposal(proposal.id, responsibleAccount),
      409,
      'PTS_NOT_DRAFT',
    );

    expect(error.message).toBe(
      'Somente propostas aguardando decisão podem ser excluídas.',
    );
    expect(repo.deletedIds.size).toBe(0);
  });

  it('permite ao admin excluir (RN022)', async () => {
    const proposal = await createDraft();

    await expect(
      service.deleteProposal(proposal.id, adminAccount),
    ).resolves.toEqual({ status: 'OK' });
  });
});

describe('PtsService.addTeamMembers (RFEM001)', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  const activePts: ActivePtsResponseDto = {
    id: 'active-100',
    status: PtsStateEnum.PLANNING,
    socialSituation: 'Situação social confidencial.',
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum confidencial.',
    cid: 'F84.0',
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação'],
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: '2026-10-15T12:30:00.000Z',
    beganAt: null,
    patient: { id: 'acc-patient-25', name: 'Priscila Martins' },
    responsible: {
      id: 'prof-10',
      name: 'Profissional responsável',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
    team: [
      {
        id: 'prof-11',
        name: 'Profissional da equipe',
        specialism: { id: 'doctor', name: 'Medicina' },
        registration: null,
      },
    ],
  };

  beforeEach(() => {
    repo = seededRepo();
    repo.activePts.push({
      ...activePts,
      team: [...activePts.team],
    });
    service = new PtsService(repo);
  });

  it('responsável adiciona perfis cadastrados à equipe de um PTS em PLANNING ou RUNNING', async () => {
    const result = await service.addTeamMembers(
      'active-100',
      { professionalIds: ['prof-15', 'prof-20'] },
      responsibleAccount,
    );

    expect(result).toMatchObject({
      id: 'active-100',
      status: PtsStateEnum.PLANNING,
      responsible: { id: 'prof-10' },
      team: [{ id: 'prof-11' }, { id: 'prof-15' }, { id: 'prof-20' }],
    });
  });

  it('permite adicionar membros quando o PTS está em RUNNING', async () => {
    repo.activePts[0].status = PtsStateEnum.RUNNING;

    const result = await service.addTeamMembers(
      'active-100',
      { professionalIds: ['prof-15'] },
      responsibleAccount,
    );

    expect(result.status).toBe(PtsStateEnum.RUNNING);
    expect(result.team.map((m) => m.id)).toEqual(['prof-11', 'prof-15']);
  });

  it('permite ao admin adicionar membros à equipe (RN022)', async () => {
    const result = await service.addTeamMembers(
      'active-100',
      { professionalIds: ['prof-15'] },
      adminAccount,
    );

    expect(result.team.map((m) => m.id)).toEqual(['prof-11', 'prof-15']);
  });

  it('retorna 404 PTS_NOT_FOUND quando o PTS não existe', async () => {
    await expectApiError(
      () =>
        service.addTeamMembers(
          'pts-inexistente',
          { professionalIds: ['prof-15'] },
          responsibleAccount,
        ),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it.each([
    ['membro da equipe', teamAccount],
    ['outro profissional', otherProfessionalAccount],
    ['paciente', patientAccount],
    ['conta sem perfil', noProfileAccount],
  ])(
    'retorna 403 FORBIDDEN quando %s tenta alterar a equipe (RN006)',
    async (_label, account) => {
      await expectApiError(
        () =>
          service.addTeamMembers(
            'active-100',
            { professionalIds: ['prof-15'] },
            account,
          ),
        403,
        'FORBIDDEN',
      );

      expect(repo.activePts[0].team.map((m) => m.id)).toEqual(['prof-11']);
    },
  );

  it.each([
    PtsStateEnum.DRAFT,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
    PtsStateEnum.REJECTED,
  ])('retorna 409 PTS_NOT_ACTIVE quando o PTS está em %s', async (status) => {
    repo.activePts[0].status = status as PtsStateEnum.PLANNING;

    const error = await expectApiError(
      () =>
        service.addTeamMembers(
          'active-100',
          { professionalIds: ['prof-15'] },
          responsibleAccount,
        ),
      409,
      'PTS_NOT_ACTIVE',
    );

    expect(error.message).toBe(
      'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
    );
    expect(repo.activePts[0].team.map((m) => m.id)).toEqual(['prof-11']);
  });

  it('retorna 400 TEAM_PROFESSIONAL_NOT_FOUND quando algum perfil não está cadastrado (sem adicionar nenhum)', async () => {
    const error = await expectApiError(
      () =>
        service.addTeamMembers(
          'active-100',
          { professionalIds: ['prof-15', 'prof-404'] },
          responsibleAccount,
        ),
      400,
      'TEAM_PROFESSIONAL_NOT_FOUND',
    );

    expect(error.professionalIds).toEqual(['prof-404']);
    expect(repo.activePts[0].team.map((m) => m.id)).toEqual(['prof-11']);
  });

  it('retorna 400 TEAM_DUPLICATE_ACCOUNT se a conta já for responsável ou já estiver na equipe, sem adicionar nenhum (RN008)', async () => {
    // Segundo perfil profissional da conta do responsável (acc-1)
    repo.professionals.set('prof-10-b', {
      id: 'prof-10-b',
      accountId: 'acc-1',
    });
    // Segundo perfil profissional da conta de um membro existente (acc-2)
    repo.professionals.set('prof-11-b', {
      id: 'prof-11-b',
      accountId: 'acc-2',
    });

    const error = await expectApiError(
      () =>
        service.addTeamMembers(
          'active-100',
          { professionalIds: ['prof-15', 'prof-10-b', 'prof-11-b'] },
          responsibleAccount,
        ),
      400,
      'TEAM_DUPLICATE_ACCOUNT',
    );

    expect(error.professionalIds).toEqual(['prof-10-b', 'prof-11-b']);
    expect(repo.activePts[0].team.map((m) => m.id)).toEqual(['prof-11']);
  });

  it('grava um member_added por profissional, com o responsável como autor', async () => {
    repo.accountNames.set('acc-1', 'Kaio Segunda Conta');

    await service.addTeamMembers(
      'active-100',
      { professionalIds: ['prof-15', 'prof-20'] },
      responsibleAccount,
    );

    expect(repo.addedRecords).toEqual([
      {
        ptsId: 'active-100',
        professionalId: 'prof-15',
        authorProfessionalId: 'prof-10',
        executedByAccountId: 'acc-1',
        description:
          'Kaio Segunda Conta adicionou Profissional prof-15 à equipe',
      },
      {
        ptsId: 'active-100',
        professionalId: 'prof-20',
        authorProfessionalId: 'prof-10',
        executedByAccountId: 'acc-1',
        description:
          'Kaio Segunda Conta adicionou Profissional prof-20 à equipe',
      },
    ]);
  });

  it('grava o admin como quem executou, sem profissional atribuído (RN029)', async () => {
    repo.accountNames.set('acc-admin', 'Kaio Admin');

    await service.addTeamMembers(
      'active-100',
      { professionalIds: ['prof-15'] },
      adminAccount,
    );

    expect(repo.addedRecords).toEqual([
      expect.objectContaining({
        authorProfessionalId: null,
        executedByAccountId: 'acc-admin',
        description: 'Kaio Admin adicionou Profissional prof-15 à equipe',
      }),
    ]);
  });

  it('usa o nome do responsável quando a conta não tem nome cadastrado', async () => {
    await service.addTeamMembers(
      'active-100',
      { professionalIds: ['prof-15'] },
      responsibleAccount,
    );

    expect(repo.addedRecords[0].description).toBe(
      'Profissional responsável adicionou Profissional prof-15 à equipe',
    );
  });

  it('não grava evento quando a adição é recusada', async () => {
    await expectApiError(
      () =>
        service.addTeamMembers(
          'active-100',
          { professionalIds: ['prof-15'] },
          teamAccount,
        ),
      403,
      'FORBIDDEN',
    );

    expect(repo.addedRecords).toHaveLength(0);
  });
});

describe('PtsService.removeTeamMember', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  const responsible = {
    id: 'prof-10',
    name: 'Kaio Segunda Conta',
    specialism: { id: 'psychologist', name: 'Psicologia' },
    registration: null,
  };
  const member = {
    id: 'prof-11',
    name: 'Ana Souza',
    specialism: { id: 'doctor', name: 'Medicina' },
    registration: null,
  };

  const seedPts = (status: PtsStateEnum = PtsStateEnum.RUNNING) => {
    repo.ptsTeams.set('pts-100', {
      id: 'pts-100',
      status,
      responsible,
      team: [member],
    });
  };

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
    seedPts();
  });

  it('remove o membro e devolve o PTS com a equipe atualizada', async () => {
    const result = await service.removeTeamMember(
      'pts-100',
      'prof-11',
      responsibleAccount,
    );

    expect(result).toEqual({
      id: 'pts-100',
      status: PtsStateEnum.RUNNING,
      responsible,
      team: [],
    });
  });

  describe('PtsService.transferResponsibility', () => {
    let repo: InMemoryPtsRepository;
    let service: PtsService;

    const responsible = {
      id: 'prof-10',
      name: 'Kaio Segunda Conta',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    };
    const member = {
      id: 'prof-11',
      name: 'Ana Souza',
      specialism: { id: 'doctor', name: 'Medicina' },
      registration: null,
    };

    const seedPts = (status: PtsStateEnum = PtsStateEnum.RUNNING) => {
      repo.ptsTeams.set('pts-100', {
        id: 'pts-100',
        status,
        responsible,
        team: [member],
      });
    };

    beforeEach(() => {
      repo = seededRepo();
      service = new PtsService(repo);
      seedPts();
    });

    it('transfere para membro da equipe e remove o responsável anterior', async () => {
      const result = await service.transferResponsibility(
        'pts-100',
        { newResponsibleId: 'prof-11' },
        responsibleAccount,
      );

      expect(result).toEqual({
        id: 'pts-100',
        status: PtsStateEnum.RUNNING,
        responsible: member,
        team: [],
      });
      expect(repo.transferredRecords).toEqual([
        {
          ptsId: 'pts-100',
          newResponsibleId: 'prof-11',
          authorProfessionalId: 'prof-10',
          executedByAccountId: 'acc-1',
          description:
            'Kaio Segunda Conta transferiu a responsabilidade do PTS para Profissional prof-11',
        },
      ]);
    });

    it('mantém a equipe quando o substituto ainda não é membro', async () => {
      const result = await service.transferResponsibility(
        'pts-100',
        { newResponsibleId: 'prof-15' },
        responsibleAccount,
      );

      expect(result.responsible.id).toBe('prof-15');
      expect(result.team).toEqual([member]);
    });

    it('retorna 404 quando o PTS não existe', async () => {
      await expectApiError(
        () =>
          service.transferResponsibility(
            'pts-999',
            { newResponsibleId: 'prof-15' },
            responsibleAccount,
          ),
        404,
        'PTS_NOT_FOUND',
      );
    });

    it('retorna 403 para outro profissional', async () => {
      await expectApiError(
        () =>
          service.transferResponsibility(
            'pts-100',
            { newResponsibleId: 'prof-15' },
            teamAccount,
          ),
        403,
        'FORBIDDEN',
      );
      expect(repo.transferredRecords).toHaveLength(0);
    });

    it.each([
      PtsStateEnum.DRAFT,
      PtsStateEnum.CONCLUDED,
      PtsStateEnum.CANCELLED,
      PtsStateEnum.REJECTED,
    ])('retorna 409 quando o PTS está em %s', async (status) => {
      seedPts(status);

      await expectApiError(
        () =>
          service.transferResponsibility(
            'pts-100',
            { newResponsibleId: 'prof-15' },
            responsibleAccount,
          ),
        409,
        'PTS_NOT_ACTIVE',
      );
      expect(repo.transferredRecords).toHaveLength(0);
    });

    it('retorna 400 quando o substituto não está cadastrado', async () => {
      await expectApiError(
        () =>
          service.transferResponsibility(
            'pts-100',
            { newResponsibleId: 'prof-missing' },
            responsibleAccount,
          ),
        400,
        'NEW_RESPONSIBLE_NOT_FOUND',
      );
      expect(repo.transferredRecords).toHaveLength(0);
    });

    it('retorna 400 quando o substituto é o responsável atual', async () => {
      await expectApiError(
        () =>
          service.transferResponsibility(
            'pts-100',
            { newResponsibleId: 'prof-10' },
            responsibleAccount,
          ),
        400,
        'NEW_RESPONSIBLE_INVALID',
      );
      expect(repo.transferredRecords).toHaveLength(0);
    });

    it('retorna 400 quando outra pessoa da equipe já usa a conta do substituto', async () => {
      repo.professionals.set('prof-30', {
        id: 'prof-30',
        accountId: 'acc-2',
      });

      await expectApiError(
        () =>
          service.transferResponsibility(
            'pts-100',
            { newResponsibleId: 'prof-30' },
            responsibleAccount,
          ),
        400,
        'TEAM_DUPLICATE_ACCOUNT',
      );
      expect(repo.transferredRecords).toHaveLength(0);
    });
  });

  it('o acesso do removido ao PTS cessa', async () => {
    await service.removeTeamMember('pts-100', 'prof-11', responsibleAccount);

    await expectApiError(
      () => service.removeTeamMember('pts-100', 'prof-11', teamAccount),
      403,
      'FORBIDDEN',
    );
    expect((await repo.findPtsTeam('pts-100'))?.team).toEqual([]);
  });

  it('grava o evento na timeline com o responsável como autor', async () => {
    repo.accountNames.set('acc-1', 'Kaio Segunda Conta');

    await service.removeTeamMember('pts-100', 'prof-11', responsibleAccount);

    expect(repo.timelineRecords).toEqual([
      {
        ptsId: 'pts-100',
        professionalId: 'prof-11',
        authorProfessionalId: 'prof-10',
        executedByAccountId: 'acc-1',
        description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
      },
    ]);
  });

  it('grava o admin como quem executou, sem profissional atribuído (RN029)', async () => {
    repo.accountNames.set('acc-admin', 'Kaio Admin');

    await service.removeTeamMember('pts-100', 'prof-11', {
      accountId: 'acc-admin',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    });

    expect(repo.timelineRecords[0]).toMatchObject({
      authorProfessionalId: null,
      executedByAccountId: 'acc-admin',
      description: 'Kaio Admin removeu Ana Souza da equipe',
    });
  });

  it('usa o nome do responsável quando a conta não tem nome cadastrado', async () => {
    await service.removeTeamMember('pts-100', 'prof-11', responsibleAccount);

    expect(repo.timelineRecords[0].description).toBe(
      'Kaio Segunda Conta removeu Ana Souza da equipe',
    );
  });

  it('aceita PTS em PLANNING', async () => {
    seedPts(PtsStateEnum.PLANNING);

    const result = await service.removeTeamMember(
      'pts-100',
      'prof-11',
      responsibleAccount,
    );

    expect(result.team).toEqual([]);
  });

  it('retorna 404 PTS_NOT_FOUND para PTS inexistente', async () => {
    await expectApiError(
      () => service.removeTeamMember('pts-999', 'prof-11', responsibleAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });

  it.each([
    ['membro da equipe', teamAccount],
    ['outro profissional', otherProfessionalAccount],
    ['paciente', patientAccount],
    ['conta sem perfil', noProfileAccount],
  ])('retorna 403 para %s', async (_label, account) => {
    await expectApiError(
      () => service.removeTeamMember('pts-100', 'prof-11', account),
      403,
      'FORBIDDEN',
    );
    expect(repo.timelineRecords).toHaveLength(0);
  });

  it.each([
    PtsStateEnum.DRAFT,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
    PtsStateEnum.REJECTED,
  ])('retorna 409 PTS_NOT_ACTIVE para PTS em %s', async (status) => {
    seedPts(status);

    await expectApiError(
      () => service.removeTeamMember('pts-100', 'prof-11', responsibleAccount),
      409,
      'PTS_NOT_ACTIVE',
    );
  });

  it('retorna 409 CANNOT_REMOVE_RESPONSIBLE ao tentar remover o responsável', async () => {
    const error = await expectApiError(
      () => service.removeTeamMember('pts-100', 'prof-10', responsibleAccount),
      409,
      'CANNOT_REMOVE_RESPONSIBLE',
    );

    expect(error.message).toBe(
      'O responsável não pode ser removido da equipe. Transfira a responsabilidade antes.',
    );
    expect(repo.timelineRecords).toHaveLength(0);
  });

  it('retorna 404 TEAM_MEMBER_NOT_FOUND para profissional fora da equipe', async () => {
    await expectApiError(
      () => service.removeTeamMember('pts-100', 'prof-20', responsibleAccount),
      404,
      'TEAM_MEMBER_NOT_FOUND',
    );
  });

  it('permite ao admin remover, sem autor profissional no evento (RN006/RN022)', async () => {
    const result = await service.removeTeamMember(
      'pts-100',
      'prof-11',
      adminAccount,
    );

    expect(result.team).toEqual([]);
    // O admin não atribui profissional, mas a conta dele fica registrada (RN029).
    expect(repo.timelineRecords[0]).toMatchObject({
      authorProfessionalId: null,
      executedByAccountId: 'acc-admin',
    });
  });

  it('mantém o 409 CANNOT_REMOVE_RESPONSIBLE para o admin', async () => {
    await expectApiError(
      () => service.removeTeamMember('pts-100', 'prof-10', adminAccount),
      409,
      'CANNOT_REMOVE_RESPONSIBLE',
    );
  });
});
