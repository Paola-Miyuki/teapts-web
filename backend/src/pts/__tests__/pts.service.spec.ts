import { PtsService } from '../services/pts.service';
import { InMemoryPtsRepository, seededRepo } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';

const body = {
  professionalId: 'prof-10',
  patientId: 'patient-25',
  socialSituation: 'Paciente em situação de vulnerabilidade social.',
  teamProfessionalIds: ['prof-11', 'prof-15'],
};

describe('PtsService.createPts', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = seededRepo();
    service = new PtsService(repo);
  });

  describe('fluxo principal', () => {
    it('cria o PTS como DRAFT com responsável e equipe', async () => {
      const res = await service.createPts(body, 'acc-1');

      expect(res).toMatchObject({
        id: '100',
        patient: {
          id: 'patient-25',
        },
        responsible: {
          id: 'prof-10',
        },
        socialSituation: body.socialSituation,
        status: 'draft',
        team: [{ id: 'prof-11' }, { id: 'prof-15' }],
      });

      expect(res.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(repo.created).toHaveLength(1);
    });

    it('aceita equipe omitida e retorna lista vazia', async () => {
      const withoutTeam = {
        professionalId: body.professionalId,
        patientId: body.patientId,
        socialSituation: body.socialSituation,
      };

      const res = await service.createPts(withoutTeam, 'acc-1');

      expect(res.team).toEqual([]);
    });

    it('remove IDs duplicados e o responsável da equipe', async () => {
      const res = await service.createPts(
        {
          ...body,
          teamProfessionalIds: ['prof-11', 'prof-11', 'prof-10'],
        },
        'acc-1',
      );

      expect(res.team.map((professional) => professional.id)).toEqual([
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
  });

  describe('autorização', () => {
    it('rejeita profissional pertencente a outra conta', async () => {
      await expectApiError(
        () =>
          service.createPts({ ...body, professionalId: 'prof-20' }, 'acc-1'),
        403,
        'PROFESSIONAL_NOT_AUTHORIZED',
      );

      expect(repo.created).toHaveLength(0);
    });

    it('trata profissional inexistente como não autorizado', async () => {
      await expectApiError(
        () =>
          service.createPts({ ...body, professionalId: 'prof-999' }, 'acc-1'),
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
  });

  describe('regras de negócio', () => {
    it('rejeita paciente inexistente', async () => {
      await expectApiError(
        () =>
          service.createPts(
            { ...body, patientId: 'patient-inexistente' },
            'acc-1',
          ),
        404,
        'PATIENT_NOT_FOUND',
      );

      expect(repo.created).toHaveLength(0);
    });

    it('impede a criação quando o paciente já possui PTS aprovado e ativo', async () => {
      repo.patientsWithApprovedActivePts.add('patient-25');

      const res = await expectApiError(
        () => service.createPts(body, 'acc-1'),
        409,
        'PTS_ACTIVE_EXISTS',
      );

      expect(res.message).toBe('O paciente já possui um PTS aprovado e ativo.');
      expect(repo.created).toHaveLength(0);
    });

    it('rejeita profissionais inexistentes na equipe', async () => {
      const res = await expectApiError(
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

      expect(res.professionalIds).toEqual(['prof-777', 'prof-888']);
      expect(repo.created).toHaveLength(0);
    });
  });
});
