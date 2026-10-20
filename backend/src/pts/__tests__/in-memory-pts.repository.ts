import { CreatePtsResponseDto } from '../dto/create-pts.dto';
import { CreateDraftInput, ProfessionalRecord, PtsRepository } from '../pts.repository';

export class InMemoryPtsRepository extends PtsRepository {
  professionals = new Map<number, ProfessionalRecord>();
  patients = new Set<number>();
  patientsWithApprovedActivePts = new Set<number>();
  created: CreatePtsResponseDto[] = [];
  private nextId = 100;

  async findProfessionalById(id: number) {
    return this.professionals.get(id) ?? null;
  }
  async patientExists(id: number) {
    return this.patients.has(id);
  }
  async hasApprovedActivePts(patientId: number) {
    return this.patientsWithApprovedActivePts.has(patientId);
  }
  async findExistingProfessionalIds(ids: number[]) {
    return ids.filter((id) => this.professionals.has(id));
  }
  async createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto> {
    const prof = this.professionals.get(input.responsibleProfessionalId);
    
    const pts: CreatePtsResponseDto = {
      id: String(this.nextId++),
      status: 'DRAFT',
      socialSituation: input.socialSituation,
      createdAt: new Date().toISOString(),
      patient: {
        id: String(input.patientId),
        name: `Paciente ${input.patientId}`,
      },
      responsible: {
        id: String(input.responsibleProfessionalId),
        name: prof ? `Profissional ${prof.id}` : 'Responsável',
        specialism: { id: 'default', name: 'Geral' },
      },
      team: input.teamProfessionalIds.map((teamId) => ({
        id: String(teamId),
        name: `Membro ${teamId}`,
        specialism: { id: 'default', name: 'Geral' },
      })),
    };

    this.created.push(pts);
    return pts;
  }
}

export function seededRepo() {
  const repo = new InMemoryPtsRepository();
  repo.professionals.set(10, { id: 10, accountId: 'acc-1' });
  repo.professionals.set(11, { id: 11, accountId: 'acc-2' });
  repo.professionals.set(15, { id: 15, accountId: 'acc-3' });
  repo.professionals.set(20, { id: 20, accountId: 'acc-9' });
  repo.patients.add(25);
  return repo;
}