import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
  type ValidationOptions,
} from 'class-validator';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { type PtsProfessionalDto } from './create-pts.dto';

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

export class PtsTeamResponseDto {
  @ApiProperty({
    example: '3f2e1d0c-9b8a-4765-a432-10fedcba9876',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    enum: [PtsStateEnum.PLANNING, PtsStateEnum.RUNNING],
    example: PtsStateEnum.PLANNING,
  })
  status!: PtsStateEnum.PLANNING | PtsStateEnum.RUNNING;

  @ApiProperty({
    example: {
      id: '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
      name: 'Kaio Segunda Conta',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
  })
  responsible!: PtsProfessionalDto;

  @ApiProperty({
    isArray: true,
    example: [
      {
        id: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
        name: 'Kaio Felipe',
        specialism: { id: 'doctor', name: 'Medicina' },
        registration: null,
      },
    ],
  })
  team!: PtsProfessionalDto[];
}
