import { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  CreateDraftInput,
  ProfessionalRecord,
  PtsRepository,
  type FindPtsProposalsInput,
  type FindPtsProposalsResult,
} from '../repositories/pts.repository';

export class InMemoryPtsRepository extends PtsRepository {
  professionals = new Map<string, ProfessionalRecord>();
  patients = new Set<string>();
  patientsWithApprovedActivePts = new Set<string>();
  created: CreatePtsResponseDto[] = [];
  private nextId = 100;

  async findProfessionalById(id: string): Promise<ProfessionalRecord | null> {
    return this.professionals.get(id) ?? null;
  }

  async patientExists(id: string): Promise<boolean> {
    return this.patients.has(id);
  }

  async hasApprovedActivePts(patientId: string): Promise<boolean> {
    return this.patientsWithApprovedActivePts.has(patientId);
  }

  async findExistingProfessionalIds(ids: string[]): Promise<string[]> {
    return ids.filter((id) => this.professionals.has(id));
  }

  private isProfessionalOnProposal(
    proposal: CreatePtsResponseDto,
    profileIds: string[],
  ): boolean {
    return (
      profileIds.includes(proposal.responsible.id) ||
      proposal.team.some((member) => profileIds.includes(member.id))
    );
  }

  async findDraftProposals(
    input: FindPtsProposalsInput,
  ): Promise<FindPtsProposalsResult> {
    const { patientId, isPatient, professionalProfileIds, page, limit } = input;

    const draftProposals = this.created.filter(
      (proposal) =>
        proposal.patient.id === patientId &&
        proposal.status === PtsStateEnum.DRAFT,
    );

    const proposals = isPatient
      ? draftProposals
      : draftProposals.filter((proposal) =>
          this.isProfessionalOnProposal(proposal, professionalProfileIds),
        );

    const ordered = [...proposals].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id.localeCompare(a.id),
    );

    const start = (page - 1) * limit;

    return {
      rows: ordered.slice(start, start + limit) as PtsProposalResponseDto[],
      total: ordered.length,
    };
  }

  async hasProposalRelation(
    patientId: string,
    profileIds: string[],
  ): Promise<boolean> {
    if (profileIds.length === 0) {
      return false;
    }

    return this.created.some(
      (proposal) =>
        proposal.patient.id === patientId &&
        this.isProfessionalOnProposal(proposal, profileIds),
    );
  }

  async findDraftProposalById(
    id: string,
  ): Promise<PtsProposalResponseDto | null> {
    const proposal = this.created.find(
      (item) => item.id === id && item.status === PtsStateEnum.DRAFT,
    );

    return (proposal as PtsProposalResponseDto | undefined) ?? null;
  }

  async createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto> {
    const prof = this.professionals.get(input.responsibleProfessionalId);

    const pts: CreatePtsResponseDto = {
      id: String(this.nextId++),
      status: PtsStateEnum.DRAFT,
      socialSituation: input.socialSituation,
      createdAt: new Date().toISOString(),
      patient: {
        id: input.patientId,
        name: `Paciente ${input.patientId}`,
      },
      responsible: {
        id: input.responsibleProfessionalId,
        name: prof ? `Profissional ${prof.id}` : 'Responsável',
        specialism: { id: 'default', name: 'Geral' },
      },
      team: (input.teamProfessionalIds ?? []).map((teamId) => ({
        id: teamId,
        name: `Membro ${teamId}`,
        specialism: { id: 'default', name: 'Geral' },
      })),
    };

    this.created.push(pts);
    return pts;
  }
}

export function seededRepo(): InMemoryPtsRepository {
  const repo = new InMemoryPtsRepository();

  repo.professionals.set('prof-10', {
    id: 'prof-10',
    accountId: 'acc-1',
  });
  repo.professionals.set('prof-11', {
    id: 'prof-11',
    accountId: 'acc-2',
  });
  repo.professionals.set('prof-15', {
    id: 'prof-15',
    accountId: 'acc-3',
  });
  repo.professionals.set('prof-20', {
    id: 'prof-20',
    accountId: 'acc-9',
  });

  repo.patients.add('patient-25');

  return repo;
}
