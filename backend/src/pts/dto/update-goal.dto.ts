import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateGoalRequestDto } from './create-goal.dto';

/** Campos da meta a alterar; a autoria não muda na edição. */
export class UpdateGoalRequestDto extends PartialType(
  OmitType(CreateGoalRequestDto, ['authorProfessionalId'] as const),
  // Só o campo ausente é opcional: null continua inválido.
  { skipNullProperties: false },
) {}
