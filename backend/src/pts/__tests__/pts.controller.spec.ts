import { PtsController } from '../pts.controller';
import { PtsService } from '../pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';

const session = (accountId: string) => ({ getUserId: () => accountId }) as never;

const body = {
  professionalId: 10,
  patientId: 25,
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: [11, 15],
};

describe('PtsController POST /pts', () => {
  let repo: InMemoryPtsRepository;
  let controller: PtsController;

  beforeEach(() => {
    repo = seededRepo();
    controller = new PtsController(new PtsService(repo));
  });

  it('usa a conta da sessão e devolve o PTS criado no formato do contrato', async () => {
    const res = await controller.create(session('acc-1'), body);
    expect(res).toMatchObject({
      id: 100,
      patientId: 25,
      responsibleProfessionalId: 10,
      status: 'DRAFT',
      teamProfessionalIds: [11, 15],
    });
  });

  it('rejeita (403) quando a sessão é de outra conta que não é dona do professionalId', async () => {
    await expectApiError(() => controller.create(session('acc-9'), body), 403, 'PROFESSIONAL_NOT_AUTHORIZED');
    expect(repo.created).toHaveLength(0);
  });

  it('rejeita (400) corpo inválido antes de consultar o repositório', async () => {
    const spy = jest.spyOn(repo, 'findProfessionalById');
    await expectApiError(() => controller.create(session('acc-1'), { ...body, socialSituation: '' }), 400, 'VALIDATION_ERROR');
    expect(spy).not.toHaveBeenCalled();
  });

  it('propaga 409 PTS_ACTIVE_EXISTS', async () => {
    repo.patientsWithApprovedActivePts.add(25);
    await expectApiError(() => controller.create(session('acc-1'), body), 409, 'PTS_ACTIVE_EXISTS');
  });
});
