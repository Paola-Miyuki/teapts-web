import type { RegisterReassessmentResponseDto } from '../dto/register-reassessment.dto';
import {
  PtsReassessmentRepository,
  type RegisterReassessmentInput,
} from '../repositories/pts-reassessment.repository';

export class InMemoryPtsReassessmentRepository extends PtsReassessmentRepository {
  registered: RegisterReassessmentInput[] = [];

  async register(
    input: RegisterReassessmentInput,
  ): Promise<RegisterReassessmentResponseDto> {
    this.registered.push(input);

    return {
      id: input.ptsId,
      status: 'concluded',
      reassessedAt: input.meetingDate,
      nextPtsId: input.createNextVersion ? 'pts-2' : null,
    };
  }
}
