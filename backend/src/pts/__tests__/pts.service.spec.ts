import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { PtsService } from '../services/pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';

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

describe('PtsService.createPts', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  it('cria uma proposta com responsável, paciente e equipe', async () => {
    const result = await service.createPts(body, 'acc-1');

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
      () => service.createPts(body, 'acc-9'),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );

    expect(repo.created).toHaveLength(0);
  });

  it('rejeita quando o paciente não existe', async () => {
    await expectApiError(
      () => service.createPts({ ...body, patientId: 'patient-404' }, 'acc-1'),
      404,
      'PATIENT_NOT_FOUND',
    );
  });

  it('rejeita quando já existe PTS aprovado e ativo', async () => {
    repo.patientsWithApprovedActivePts.add('patient-25');

    await expectApiError(
      () => service.createPts(body, 'acc-1'),
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

    const result = await service.createPts(withoutTeam, 'acc-1');

    expect(result.team).toEqual([]);
  });

  it('remove IDs duplicados e o responsável da equipe', async () => {
    const result = await service.createPts(
      {
        ...body,
        teamProfessionalIds: ['prof-11', 'prof-11', 'prof-10'],
      },
      'acc-1',
    );

    expect(result.team.map((professional) => professional.id)).toEqual([
      'prof-11',
    ]);
  });

  it('não é bloqueado por PTS ativo de outro paciente', async () => {
    repo.patients.add('patient-26');
    repo.patientsWithApprovedActivePts.add('patient-26');

    await expect(service.createPts(body, 'acc-1')).resolves.toMatchObject({
      patient: { id: 'patient-25' },
    });
  });

  it('trata profissional inexistente como não autorizado', async () => {
    await expectApiError(
      () => service.createPts({ ...body, professionalId: 'prof-999' }, 'acc-1'),
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
          'acc-1',
        ),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );
  });

  it('rejeita o profissional quando a sessão pertence a outra conta', async () => {
    await expectApiError(
      () => service.createPts(body, 'acc-2'),
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
          'acc-1',
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
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      patientAccount,
    );

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('permite que o profissional responsável consulte as propostas', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      responsibleAccount,
    );

    expect(result.data).toHaveLength(1);
  });

  it('permite que um integrante da equipe consulte as propostas', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    const result = await service.findDraftProposals(
      { patientId: 'acc-patient-25', page: 1, limit: 20 },
      teamAccount,
    );

    expect(result.data).toHaveLength(1);
  });

  it('rejeita profissional sem vínculo com o paciente', async () => {
    const proposal = await service.createPts(body, 'acc-1');
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
    const primeiraProposta = await service.createPts(body, 'acc-1');
    primeiraProposta.patient.id = 'acc-patient-25';

    const segundaProposta = await service.createPts(
      {
        ...body,
        professionalId: 'prof-11',
        teamProfessionalIds: ['prof-15'],
      },
      'acc-2',
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
    const proposal = await service.createPts(body, 'acc-1');
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
    const proposal = await service.createPts(body, 'acc-1');
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
    const proposal = await service.createPts(body, 'acc-1');
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
    const proposal = await service.createPts(body, 'acc-1');
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
    const first = await service.createPts(body, 'acc-1');
    first.patient.id = 'acc-patient-25';
    const second = await service.createPts(body, 'acc-1');
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

describe('PtsService.findDraftProposalById', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  it('permite que o paciente consulte sua própria proposta', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, patientAccount),
    ).resolves.toMatchObject({
      id: proposal.id,
      status: PtsStateEnum.DRAFT,
    });
  });

  it('permite que o profissional responsável consulte a proposta', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, responsibleAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('permite que um integrante da equipe consulte a proposta', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, teamAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('rejeita profissional sem vínculo com a proposta', async () => {
    const proposal = await service.createPts(body, 'acc-1');
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
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    await expect(
      service.findDraftProposalById(proposal.id, patientAndTeamAccount),
    ).resolves.toMatchObject({ id: proposal.id });
  });

  it('rejeita paciente que consulta proposta de outro paciente', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, otherPatientAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('rejeita conta sem perfil de paciente nem profissional', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, noProfileAccount),
      403,
      'FORBIDDEN',
    );
  });

  it('retorna 404 quando a proposta não está mais em DRAFT', async () => {
    const proposal = await service.createPts(body, 'acc-1');
    proposal.patient.id = 'acc-patient-25';
    proposal.status = PtsStateEnum.CONCLUDED;

    await expectApiError(
      () => service.findDraftProposalById(proposal.id, patientAccount),
      404,
      'PTS_NOT_FOUND',
    );
  });
});
