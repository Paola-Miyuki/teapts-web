import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, type ValidationOptions } from 'class-validator';

function validationContext(message: string): ValidationOptions {
  return {
    message,
    context: { status: 'VALIDATION_ERROR' },
  };
}

export class TransferPtsResponsibilityRequestDto {
  @ApiProperty({
    description:
      'ID (UUID) do perfil profissional que assumirá a responsabilidade pelo PTS',
    example: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
    format: 'uuid',
  })
  @IsUUID('4', validationContext('newResponsibleId deve ser um UUID válido.'))
  newResponsibleId!: string;
}
