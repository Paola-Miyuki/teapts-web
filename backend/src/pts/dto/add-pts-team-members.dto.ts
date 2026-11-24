import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
  type ValidationOptions,
} from 'class-validator';

function validationContext(message: string): ValidationOptions {
  return {
    message,
    context: { status: 'VALIDATION_ERROR' },
  };
}

export class AddPtsTeamMembersRequestDto {
  @ApiProperty({
    description:
      'Lista de IDs (UUIDs) dos perfis profissionais a adicionar (ao menos um, sem repetidos)',
    example: ['5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'],
    type: [String],
    format: 'uuid',
  })
  @IsArray(validationContext('professionalIds deve ser uma lista de UUIDs.'))
  @ArrayMinSize(
    1,
    validationContext('Informe ao menos um profissional para adicionar.'),
  )
  @ArrayUnique(
    validationContext('A lista professionalIds não pode conter IDs repetidos.'),
  )
  @IsUUID('4', {
    each: true,
    ...validationContext(
      'Cada item de professionalIds deve ser um UUID válido.',
    ),
  })
  professionalIds!: string[];
}
