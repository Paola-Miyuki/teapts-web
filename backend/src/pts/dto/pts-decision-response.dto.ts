import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export class PtsDecisionResponseDto {
  id: string;
  status: PtsStateEnum.PLANNING | PtsStateEnum.REJECTED;
  acceptedAt: string | null;
  rejectedAt: string | null;
}
