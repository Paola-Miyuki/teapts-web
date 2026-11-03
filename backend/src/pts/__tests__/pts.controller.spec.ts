import { PtsController } from '../controllers/pts.controller';
import { PtsService } from '../services/pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

const body = {
  professionalId: 'prof-10',
  patientId: 'patient-25',
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: ['prof-11', 'prof-15'],
};

const accountOf = (accountId: string): AccountContext => ({
  accountId,
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
});

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

describe('PtsController GET /pts/active', () => {
  let repo: InMemoryPtsRepository;
  let controller: PtsController;

  beforeEach(() => {
    repo = seededRepo();
    controller = new PtsController(new PtsService(repo));
    repo.activePts.push({
      id: 'active-100',
      status: PtsStateEnum.PLANNING,
      socialSituation: 'Situação social confidencial.',
      createdAt: '2026-10-15T12:00:00.000Z',
      acceptedAt: '2026-10-15T12:30:00.000Z',
      beganAt: null,
      patient: { id: 'acc-patient-25', name: 'Priscila Martins' },
      responsible: {
        id: 'prof-10',
        name: 'Profissional responsável',
        specialism: { id: 'psychologist', name: 'Psicologia' },
      },
      team: [],
    });
  });

  it('retorna a consulta do PTS ativo para o paciente', async () => {
    const result = await controller.findActive(
      { patientId: 'acc-patient-25' },
      {
        accountId: 'acc-patient-25',
        role: AccountRole.User,
        patientProfileId: 'acc-patient-25',
        professionalProfileIds: [],
      },
    );

    expect(result).toMatchObject({
      id: 'active-100',
      status: PtsStateEnum.PLANNING,
    });
    expect(result).not.toHaveProperty('socialSituation');
  });
});

describe('PtsController POST /pts', () => {
  let repo: InMemoryPtsRepository;
  let controller: PtsController;

  beforeEach(() => {
    repo = seededRepo();
    controller = new PtsController(new PtsService(repo));
  });

  it('usa a conta da sessão e retorna o PTS criado', async () => {
    const res = await controller.create(body, accountOf('acc-1'));

    expect(res).toMatchObject({
      id: '100',
      patient: { id: 'patient-25' },
      responsible: { id: 'prof-10' },
      status: 'draft',
      team: [{ id: 'prof-11' }, { id: 'prof-15' }],
    });
  });

  it('rejeita quando a sessão não pertence ao profissional responsável', async () => {
    await expectApiError(
      () => controller.create(body, accountOf('acc-9')),
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
    );

    expect(repo.created).toHaveLength(0);
  });

  it('propaga o erro de PTS aprovado e ativo', async () => {
    repo.patientsWithApprovedActivePts.add('patient-25');

    await expectApiError(
      () => controller.create(body, accountOf('acc-1')),
      409,
      'PTS_ACTIVE_EXISTS',
    );
  });
});

describe('PtsController PATCH /pts/proposals/:id', () => {
  let repo: InMemoryPtsRepository;
  let controller: PtsController;

  beforeEach(() => {
    repo = seededRepo();
    controller = new PtsController(new PtsService(repo));
  });

  it('atualiza uma proposta pela rota de edição', async () => {
    const proposal = await controller.create(body, accountOf('acc-1'));
    proposal.patient.id = 'acc-patient-25';

    const result = await controller.updateProposal(
      proposal.id,
      { socialSituation: 'Situação social atualizada.' },
      responsibleAccount,
    );

    expect(result).toMatchObject({
      id: proposal.id,
      socialSituation: 'Situação social atualizada.',
      status: PtsStateEnum.DRAFT,
    });
  });

  it('rejeita edição por integrante da equipe', async () => {
    const proposal = await controller.create(body, accountOf('acc-1'));

    await expectApiError(
      () =>
        controller.updateProposal(
          proposal.id,
          { socialSituation: 'Alteração indevida.' },
          teamAccount,
        ),
      403,
      'PTS_PROPOSAL_EDIT_FORBIDDEN',
    );
  });
});

describe('PtsController PATCH /pts/:id/social-situation', () => {
  let repo: InMemoryPtsRepository;
  let controller: PtsController;

  beforeEach(() => {
    repo = seededRepo();
    controller = new PtsController(new PtsService(repo));
    repo.socialSituationTargets.set('pts-100', {
      id: 'pts-100',
      status: PtsStateEnum.RUNNING,
      responsibleProfessionalId: 'prof-10',
      teamProfessionalIds: ['prof-11'],
    });
  });

  it('atualiza a situação social pela rota', async () => {
    await expect(
      controller.updateSocialSituation(
        'pts-100',
        { socialSituation: 'Mora com a mãe e a avó.' },
        teamAccount,
      ),
    ).resolves.toEqual({
      id: 'pts-100',
      socialSituation: 'Mora com a mãe e a avó.',
    });
  });
});
