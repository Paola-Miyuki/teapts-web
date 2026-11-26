import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, type ValidationOptions } from 'class-validator';

function invalidPatientId(): ValidationOptions {
  return {
    message: 'Parâmetro inválido: patientId',
    context: { status: 'VALIDATION_ERROR' },
  };
}

export class GetActivePtsQueryDto {
  @ApiProperty({
    description: 'ID da conta do paciente',
    example: '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b',
    format: 'uuid',
  })
  @IsUUID(undefined, invalidPatientId())
  patientId!: string;
}
