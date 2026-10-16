import { CreatePtsResponseDto } from './dto/create-pts.dto';

export interface ProfessionalRecord {
  id: number;
  /** Id da conta (SuperTokens user id) dona deste perfil profissional. */
  accountId: string;
}

export interface CreateDraftInput {
  patientId: number;
  responsibleProfessionalId: number;
  socialSituation: string;
  teamProfessionalIds: number[];
}

/** Porta de persistência. A implementação concreta depende do ORM do projeto. */
export abstract class PtsRepository {
  abstract findProfessionalById(id: number): Promise<ProfessionalRecord | null>;
  abstract patientExists(id: number): Promise<boolean>;
  /** true se o paciente tem PTS com status aprovado E ativo. */
  abstract hasApprovedActivePts(patientId: number): Promise<boolean>;
  /** Retorna, dentre os ids informados, apenas os que existem. */
  abstract findExistingProfessionalIds(ids: number[]): Promise<number[]>;
  /** Cria o PTS (status DRAFT) e a equipe inicial na mesma transação. */
  abstract createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto>;
}
