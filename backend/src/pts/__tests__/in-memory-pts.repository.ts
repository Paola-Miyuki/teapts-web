import { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
import type { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import type { UpdatePtsProposalInput } from '../repositories/pts.repository';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  CreateDraftInput,
  ProfessionalRecord,
  ProposalDecisionTarget,
  PtsRepository,
  type FindPtsProposalsInput,
  type FindPtsProposalsResult,
  type RemoveTeamMemberInput,
  type AddTeamMembersInput,
  type SocialSituationTarget,
  type PtsTeamTarget,
  type ProfessionalAccountRecord,
} from '../repositories/pts.repository';
import type { UpdateSocialSituationResponseDto } from '../dto/update-social-situation.dto';
import type { PtsTeamResponseDto } from '../dto/pts-team-response.dto';

export class InMemoryPtsRepository extends PtsRepository {
  professionals = new Map<string, ProfessionalRecord>();
  patients = new Set<string>();
  patientsWithApprovedActivePts = new Set<string>();
  created: CreatePtsResponseDto[] = [];
  activePts: ActivePtsResponseDto[] = [];
  ptsById = new Map<string, PtsDetailResponseDto>();
  ptsTeams = new Map<string, PtsTeamResponseDto>();
  timelineRecords: RemoveTeamMemberInput[] = [];
  /** Eventos member_added: um por profissional adicionado. */
  addedRecords: Array<
    Omit<AddTeamMembersInput, 'members'> & {
      professionalId: string;
      description: string;
    }
  > = [];
  socialSituationTargets = new Map<string, SocialSituationTarget>();
  /** Ids com deletedAt preenchido (exclusão lógica). */
  deletedIds = new Set<string>();
  private nextId = 100;

  // Como o TypeORM com @DeleteDateColumn: excluídas somem das consultas.
  private get visible(): CreatePtsResponseDto[] {
    return this.created.filter((proposal) => !this.deletedIds.has(proposal.id));
  }

  async softDeleteProposal(id: string): Promise<void> {
    this.deletedIds.add(id);
  }

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
    const {
      patientId,
      q,
      isPatient,
      isAdmin,
      professionalProfileIds,
      page,
      limit,
    } = input;
    const term = q?.toLocaleLowerCase('pt-BR');

    const draftProposals = this.visible.filter(
      (proposal) =>
        (!patientId || proposal.patient.id === patientId) &&
        (!term ||
          proposal.patient.name.toLocaleLowerCase('pt-BR').includes(term)) &&
        proposal.status === PtsStateEnum.DRAFT,
    );

    const proposals =
      isPatient || isAdmin
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

    return this.visible.some(
      (proposal) =>
        proposal.patient.id === patientId &&
        this.isProfessionalOnProposal(proposal, profileIds),
    );
  }

  async findDraftProposalById(
    id: string,
  ): Promise<PtsProposalResponseDto | null> {
    const proposal = this.visible.find(
      (item) => item.id === id && item.status === PtsStateEnum.DRAFT,
    );

    return (proposal as PtsProposalResponseDto | undefined) ?? null;
  }

  async findActivePtsByPatientId(
    patientId: string,
  ): Promise<ActivePtsResponseDto | null> {
    return this.activePts.find((pts) => pts.patient.id === patientId) ?? null;
  }

  async findPtsById(id: string): Promise<PtsDetailResponseDto | null> {
    return this.ptsById.get(id) ?? null;
  }

  async findProposalById(id: string): Promise<PtsProposalResponseDto | null> {
    return (
      (this.visible.find((proposal) => proposal.id === id) as
        PtsProposalResponseDto | undefined) ?? null
    );
  }

  async updateDraftProposal(
    input: UpdatePtsProposalInput,
  ): Promise<PtsProposalResponseDto> {
    const proposal = await this.findProposalById(input.id);

    if (!proposal) {
      throw new Error('Proposta não encontrada.');
    }

    if (input.socialSituation !== undefined) {
      proposal.socialSituation = input.socialSituation;
    }

    if (input.teamProfessionalIds !== undefined) {
      proposal.team = input.teamProfessionalIds.map((professionalId) => ({
        id: professionalId,
        name: `Membro ${professionalId}`,
        specialism: { id: 'default', name: 'Geral' },
        registration: null,
      }));
    }

    return proposal;
  }

  async findSocialSituationTarget(
    id: string,
  ): Promise<SocialSituationTarget | null> {
    return this.socialSituationTargets.get(id) ?? null;
  }

  async updateSocialSituation(
    id: string,
    socialSituation: string,
  ): Promise<UpdateSocialSituationResponseDto> {
    return { id, socialSituation };
  }

  async findProposalForDecision(
    id: string,
  ): Promise<ProposalDecisionTarget | null> {
    const proposal = this.visible.find((item) => item.id === id);

    return proposal
      ? {
          id: proposal.id,
          status: proposal.status,
          patientId: proposal.patient.id,
        }
      : null;
  }

  async approveProposal(
    id: string,
    patientId: string,
  ): Promise<PtsDecisionResponseDto> {
    const proposal = this.visible.find((item) => item.id === id);

    if (!proposal) {
      throw new Error('Proposta não encontrada.');
    }

    const now = new Date().toISOString();
    proposal.status = PtsStateEnum.PLANNING;

    for (const otherProposal of this.visible) {
      if (
        otherProposal.patient.id === patientId &&
        otherProposal.id !== id &&
        otherProposal.status === PtsStateEnum.DRAFT
      ) {
        otherProposal.status = PtsStateEnum.REJECTED;
      }
    }

    return {
      id,
      status: PtsStateEnum.PLANNING,
      acceptedAt: now,
      rejectedAt: null,
    };
  }

  async rejectProposal(id: string): Promise<PtsDecisionResponseDto> {
    const proposal = this.visible.find((item) => item.id === id);

    if (!proposal) {
      throw new Error('Proposta não encontrada.');
    }

    const rejectedAt = new Date().toISOString();
    proposal.status = PtsStateEnum.REJECTED;

    return {
      id,
      status: PtsStateEnum.REJECTED,
      acceptedAt: null,
      rejectedAt,
    };
  }

  accountNames = new Map<string, string>();

  async findAccountDisplayName(accountId: string): Promise<string | null> {
    return this.accountNames.get(accountId) ?? null;
  }

  async findPtsTeam(id: string): Promise<PtsTeamResponseDto | null> {
    const pts = this.ptsTeams.get(id);

    return pts ? { ...pts, team: [...pts.team] } : null;
  }

  async removeTeamMember(
    input: RemoveTeamMemberInput,
  ): Promise<PtsTeamResponseDto> {
    const pts = this.ptsTeams.get(input.ptsId);

    if (!pts) {
      throw new Error('PTS não encontrado.');
    }

    pts.team = pts.team.filter(
      (professional) => professional.id !== input.professionalId,
    );
    this.timelineRecords.push({ ...input });

    return { ...pts, team: [...pts.team] };
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
        registration: null,
      },
      team: (input.teamProfessionalIds ?? []).map((teamId) => ({
        id: teamId,
        name: `Membro ${teamId}`,
        specialism: { id: 'default', name: 'Geral' },
        registration: null,
      })),
    };

    this.created.push(pts);
    return pts;
  }

  async findPtsTeamTarget(id: string): Promise<PtsTeamTarget | null> {
    const pts =
      this.activePts.find((item) => item.id === id) ??
      this.ptsById.get(id) ??
      this.visible.find((item) => item.id === id);

    if (!pts) {
      return null;
    }

    const responsibleRecord = this.professionals.get(pts.responsible.id);

    return {
      id: pts.id,
      status: pts.status as PtsStateEnum,
      responsibleProfessionalId: pts.responsible.id,
      responsibleAccountId: responsibleRecord?.accountId ?? '',
      responsibleName: pts.responsible.name,
      teamMembers: pts.team.map((member) => ({
        professionalId: member.id,
        accountId: this.professionals.get(member.id)?.accountId ?? '',
      })),
    };
  }

  async findProfessionalsWithAccountByIds(
    ids: string[],
  ): Promise<ProfessionalAccountRecord[]> {
    return ids.flatMap((id) => {
      const record = this.professionals.get(id);

      return record ? [{ ...record, name: `Profissional ${record.id}` }] : [];
    });
  }

  async addTeamMembers(
    input: AddTeamMembersInput,
  ): Promise<PtsTeamResponseDto> {
    const { ptsId } = input;
    const professionalIds = input.members.map(
      (member) => member.professionalId,
    );
    const pts =
      this.activePts.find((item) => item.id === ptsId) ??
      this.ptsById.get(ptsId) ??
      this.visible.find((item) => item.id === ptsId);

    if (!pts) {
      throw new Error('PTS não encontrado.');
    }

    const newMembers = professionalIds.map((professionalId) => ({
      id: professionalId,
      name: `Profissional ${professionalId}`,
      specialism: { id: 'default', name: 'Geral' },
      registration: null,
    }));

    pts.team = [...pts.team, ...newMembers];

    for (const member of input.members) {
      this.addedRecords.push({
        ptsId,
        professionalId: member.professionalId,
        description: member.description,
        authorProfessionalId: input.authorProfessionalId,
        executedByAccountId: input.executedByAccountId,
      });
    }

    return {
      id: pts.id,
      status: pts.status as PtsStateEnum.PLANNING | PtsStateEnum.RUNNING,
      responsible: pts.responsible,
      team: pts.team,
    };
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
