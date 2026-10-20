import { PtsService } from '../pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';

const body = {
  professionalId: 10,
  patientId: 25,
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: [11, 15],
};

describe('PtsService.create', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  describe('fluxo principal', () => {
    it('cria o PTS como DRAFT, com o profissional autenticado como responsável e a equipe associada', async () => {
      const res = await service.create('acc-1', body);

      expect(res).toEqual({
        id: 100,
        patientId: 25,
        responsibleProfessionalId: 10,
        socialSituation: body.socialSituation,
        status: 'DRAFT',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
        teamProfessionalIds: [11, 15],
      });
      expect(repo.created).toHaveLength(1);
    });

    it('aceita equipe omitida e retorna lista vazia', async () => {
      const { teamProfessionalIds: _omit, ...withoutTeam } = body;
      const res = await service.create('acc-1', withoutTeam);
      expect(res.teamProfessionalIds).toEqual([]);
    });

    it('remove ids duplicados e o próprio responsável da equipe', async () => {
      const res = await service.create('acc-1', { ...body, teamProfessionalIds: [11, 11, 10] });
      expect(res.teamProfessionalIds).toEqual([11]);
    });

    it('não é bloqueado por PTS de outro paciente', async () => {
      repo.patients.add(26);
      repo.patientsWithApprovedActivePts.add(26);
      await expect(service.create('acc-1', body)).resolves.toMatchObject({ patientId: 25 });
    });
  });

  describe('autorização', () => {
    it('rejeita perfil profissional de outra conta (403) e não cria nada', async () => {
      await expectApiError(
        () => service.create('acc-1', { ...body, professionalId: 20 }),
        403,
        'PROFESSIONAL_NOT_AUTHORIZED',
      );
      expect(repo.created).toHaveLength(0);
    });

    it('trata perfil inexistente como não autorizado (não revela ids)', async () => {
      await expectApiError(() => service.create('acc-1', { ...body, professionalId: 999 }), 403, 'PROFESSIONAL_NOT_AUTHORIZED');
    });

    it('verifica a autorização antes de revelar se o paciente existe', async () => {
      await expectApiError(
        () => service.create('acc-1', { ...body, professionalId: 20, patientId: 9999 }),
        403,
        'PROFESSIONAL_NOT_AUTHORIZED',
      );
    });

    it('usa a conta da sessão: mesmo id de profissional é rejeitado para outra conta', async () => {
      await expectApiError(() => service.create('acc-2', body), 403, 'PROFESSIONAL_NOT_AUTHORIZED');
    });
  });

  describe('regras de negócio', () => {
    it('rejeita paciente inexistente (404)', async () => {
      await expectApiError(() => service.create('acc-1', { ...body, patientId: 9999 }), 404, 'PATIENT_NOT_FOUND');
      expect(repo.created).toHaveLength(0);
    });

    it('impede a criação quando o paciente já tem PTS aprovado e ativo (409)', async () => {
      repo.patientsWithApprovedActivePts.add(25);
      const res = await expectApiError(() => service.create('acc-1', body), 409, 'PTS_ACTIVE_EXISTS');
      expect(res.message).toBe('O paciente já possui um PTS aprovado e ativo.');
      expect(repo.created).toHaveLength(0);
    });

    it('rejeita equipe com profissional inexistente (400) e informa quais ids', async () => {
      const res = await expectApiError(
        () => service.create('acc-1', { ...body, teamProfessionalIds: [11, 777, 888] }),
        400,
        'TEAM_PROFESSIONAL_NOT_FOUND',
      );
      expect(res.professionalIds).toEqual([777, 888]);
      expect(repo.created).toHaveLength(0);
    });
  });
});
