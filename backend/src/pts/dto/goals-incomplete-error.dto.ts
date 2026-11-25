import { ApiProperty } from '@nestjs/swagger';

export class GoalsIncompleteErrorDto {
  @ApiProperty({ example: 'GOALS_INCOMPLETE' })
  status!: 'GOALS_INCOMPLETE';

  @ApiProperty({
    example: 'Defina o prazo e a data-alvo de todas as metas antes de aprovar.',
  })
  message!: string;

  @ApiProperty({ example: 2 })
  pendingGoals!: number;
}
