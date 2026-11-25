import { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
import type { PtsHistoryItemDto } from '../dto/pts-history.dto';
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
  type FindPtsHistoryInput,
  type FindPtsHistoryResult,
  type RemoveTeamMemberInput,
  type AddTeamMembersInput,
  type PtsSheetTarget,
  type UpdatePtsSheetInput,
  type PtsTeamTarget,
  type ProfessionalAccountRecord,
  type TransferResponsibilityInput,
  type ClosePtsInput,
  type StartPtsInput,
} from '../repositories/pts.repository';
import type { ClosePtsResponseDto } from '../dto/close-pts.dto';
import type { PtsStartResponseDto } from '../dto/pts-start-response.dto';
import type { UpdatePtsSheetResponseDto } from '../dto/update-pts-sheet.dto';
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
  transferredRecords: TransferResponsibilityInput[] = [];
  startedRecords: StartPtsInput[] = [];
  closedRecords: ClosePtsInput[] = [];
  proposalUpdates: UpdatePtsProposalInput[] = [];
  /** Metas sem prazo ou data-alvo, por proposta (RFPTS013). */
  pendingGoals = new Map<string, number>();
  /** Maior data-alvo das metas, por proposta. */
  latestGoalTargets = new Map<string, string>();
  /** Eventos member_added: um por profissional adicionado. */
  addedRecords: Array<
    Omit<AddTeamMembersInput, 'members'> & {
      professionalId: string;
      description: string;
    }
  > = [];
  sheetTargets = new Map<string, PtsSheetTarget>();
  /** Atualizações da ficha (cada uma vira um `pts_updated`). */
  sheetUpdates: UpdatePtsSheetInput[] = [];
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

  async findPtsHistory(
    input: FindPtsHistoryInput,
  ): Promise<FindPtsHistoryResult> {
    const allForPatient = [...this.ptsById.values()]
      .filter((pts) => pts.patient.id === input.patientId)
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
    const versionById = new Map(
      allForPatient.map((pts, index) => [pts.id, index + 1]),
    );
    const accessible = allForPatient.filter(
      (pts) =>
        input.professionalProfileIds.length === 0 ||
        input.professionalProfileIds.includes(pts.responsible.id) ||
        pts.team.some((member) =>
          input.professionalProfileIds.includes(member.id),
        ),
    );
    const descending = accessible.reverse();
    const start = (input.page - 1) * input.limit;
    const rows: PtsHistoryItemDto[] = descending
      .slice(start, start + input.limit)
      .map((pts) => ({
        id: pts.id,
        version: versionById.get(pts.id) ?? 1,
        status: pts.status,
        responsible: {
          id: pts.responsible.id,
          name: pts.responsible.name,
          specialism: pts.responsible.specialism.name,
        },
        team: pts.team.map(({ id, name }) => ({ id, name })),
        createdAt: pts.createdAt,
        acceptedAt: pts.acceptedAt,
        beganAt: pts.beganAt,
        closedAt: pts.concludedAt ?? pts.cancelledAt ?? pts.rejectedAt,
        goalsResult: null,
      }));

    return { rows, total: accessible.length };
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

    this.proposalUpdates.push(input);

    if (input.sheet.socialSituation !== undefined) {
      proposal.socialSituation = input.sheet.socialSituation;
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

  async countPendingGoals(ptsId: string): Promise<number> {
    return this.pendingGoals.get(ptsId) ?? 0;
  }

  async findLatestGoalTarget(ptsId: string): Promise<string | null> {
    return this.latestGoalTargets.get(ptsId) ?? null;
  }

  async findSheetTarget(id: string): Promise<PtsSheetTarget | null> {
    return this.sheetTargets.get(id) ?? null;
  }

  async updateSheet(
    input: UpdatePtsSheetInput,
  ): Promise<UpdatePtsSheetResponseDto> {
    this.sheetUpdates.push(input);

    return { id: input.ptsId, ...input.sheet };
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

  async transferResponsibility(
    input: TransferResponsibilityInput,
  ): Promise<PtsTeamResponseDto> {
    const pts = this.ptsTeams.get(input.ptsId);

    if (!pts) {
      throw new Error('PTS não encontrado.');
    }

    const newResponsible = this.professionals.get(input.newResponsibleId);

    if (!newResponsible) {
      throw new Error('Profissional responsável não encontrado.');
    }

    const newResponsibleSummary = pts.team.find(
      (professional) => professional.id === input.newResponsibleId,
    ) ?? {
      id: newResponsible.id,
      name: `Profissional ${newResponsible.id}`,
      specialism: { id: 'default', name: 'Geral' },
      registration: null,
    };

    pts.team = pts.team.filter(
      (professional) =>
        professional.id !== pts.responsible.id &&
        professional.id !== input.newResponsibleId,
    );
    pts.responsible = newResponsibleSummary;
    this.transferredRecords.push({ ...input });

    return { ...pts, team: [...pts.team] };
  }

  async closePts(input: ClosePtsInput): Promise<ClosePtsResponseDto> {
    this.ptsTeams.get(input.ptsId)!.status = input.outcome as PtsStateEnum;
    this.closedRecords.push(input);

    return {
      id: input.ptsId,
      status: input.outcome,
      closingDate: input.closingDate,
      closingReason: input.closingReason,
    };
  }

  async startPts(input: StartPtsInput): Promise<PtsStartResponseDto> {
    const pts = this.ptsTeams.get(input.ptsId);

    if (!pts) {
      throw new Error('PTS não encontrado.');
    }

    pts.status = PtsStateEnum.RUNNING;
    this.startedRecords.push({ ...input });

    return {
      id: input.ptsId,
      status: PtsStateEnum.RUNNING,
      beganAt: '2026-12-01T13:00:00.000Z',
    };
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
    const team = this.ptsTeams.get(id);

    if (team) {
      const responsibleRecord = this.professionals.get(team.responsible.id);

      return {
        id: team.id,
        status: team.status,
        responsibleProfessionalId: team.responsible.id,
        responsibleAccountId: responsibleRecord?.accountId ?? '',
        responsibleName: team.responsible.name,
        teamMembers: team.team.map((member) => ({
          professionalId: member.id,
          accountId: this.professionals.get(member.id)?.accountId ?? '',
        })),
      };
    }

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
