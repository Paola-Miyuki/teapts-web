import { PtsEntity } from '../entities/pts.entity';

export type CreateDraftInput = {
  patientId: string;
  responsibleProfessionalId: string;
  socialSituation: string;
  teamProfessionalIds?: string[];
};

export abstract class PtsRepository {
  abstract createDraft(input: CreateDraftInput): Promise<PtsEntity>;

  abstract findPtsById(id: string): Promise<PtsEntity | null>;

  abstract findProposalsByPatientId(
    patientId: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: PtsEntity[]; total: number }>;
}
