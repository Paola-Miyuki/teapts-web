import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { CreateActivityRequestDto } from './create-activity.dto';

/**
 * Campos que a edição altera (RFACT005). Especialidade, quem executa e a
 * autoria não mudam aqui.
 */
export class UpdateActivityRequestDto extends PartialType(
  PickType(CreateActivityRequestDto, [
    'title',
    'description',
    'type',
    'frequency',
    'modality',
    'visitPlace',
    'documentIds',
  ] as const),
  // Só o campo ausente é opcional: null continua inválido.
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Meta do mesmo PTS; null desliga a atividade da meta.',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'goalId deve ser um UUID válido.' })
  goalId?: string | null;
}
