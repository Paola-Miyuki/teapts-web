import { PtsController } from '../controllers/pts.controller';
import { PtsService } from '../services/pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';

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
