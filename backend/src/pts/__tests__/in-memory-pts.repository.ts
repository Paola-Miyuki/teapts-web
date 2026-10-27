import { PtsEntity } from '../entities/pts.entity';
import { PtsRepository, CreateDraftInput } from '../repositories/pts.repository';

export class InMemoryPtsRepository extends PtsRepository {
  public items: PtsEntity[] = [];

  async createDraft(input: CreateDraftInput): Promise<PtsEntity> {
    const pts: PtsEntity = {
      id: `pts-${Date.now()}`,
      status: 'draft',
      socialSituation: input.socialSituation,
      createdAt: new Date(),
      patientId: input.patientId,
      responsibleProfessionalId: input.responsibleProfessionalId,
    };

    this.items.push(pts);
    return pts;
  }

  async findPtsById(id: string): Promise<PtsEntity | null> {
    const item = this.items.find((pts) => pts.id === id);
    return item || null;
  }

  async findProposalsByPatientId(
    patientId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: PtsEntity[]; total: number }> {
    const filtered = this.items.filter(
      (pts) => pts.patientId === patientId,
    );
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, total: filtered.length };
  }
}