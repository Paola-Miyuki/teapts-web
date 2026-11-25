import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { CreateAppointmentRequestDto } from './create-appointment.dto';

const REASON_MESSAGE = 'Informe a justificativa da retificação.';

/** Os campos do atendimento corrigidos e o porquê (RFACT007, RN020). */
export class RectifyAppointmentRequestDto extends CreateAppointmentRequestDto {
  @ApiProperty({
    description: 'Justificativa da retificação, obrigatória.',
    example: 'Horário de término registrado errado.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: REASON_MESSAGE })
  @IsNotEmpty({ message: REASON_MESSAGE })
  reason: string;
}

export class RectifyAppointmentResponseDto {
  @ApiProperty({ example: '6d5c4b3a-2190-4f8e-8d7c-6b5a49382716' })
  id: string;

  @ApiProperty({ example: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807' })
  rectifiesAppointmentId: string;

  @ApiProperty({ example: '2026-12-04T12:00:00.000Z' })
  createdAt: string;
}
