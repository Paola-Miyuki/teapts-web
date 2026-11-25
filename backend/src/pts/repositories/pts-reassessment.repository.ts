import type {
  GoalResult,
  RegisterReassessmentResponseDto,
} from '../dto/register-reassessment.dto';
import type { NextVersionActor } from '../services/pts-next-version.service';

export interface RegisterReassessmentInput {
  ptsId: string;
  meetingDate: string;
  goals: { goalId: string; status: GoalResult; note: string | null }[];
  createNextVersion: boolean;
  /** Motivo opcional, gravado como closing_reason do PTS. */
  reason: string | null;
  /** Quem registra; professionalId nulo quando o admin age (RN029). */
  actor: NextVersionActor;
}

export abstract class PtsReassessmentRepository {
  /**
   * Na mesma transação: resultado das metas, reassessed_at, próxima versão
   * (se pedida), conclusão do PTS e das atividades, e os eventos.
   */
  abstract register(
    input: RegisterReassessmentInput,
  ): Promise<RegisterReassessmentResponseDto>;
}
