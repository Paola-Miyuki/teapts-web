import { ApiProperty } from '@nestjs/swagger';

import { Attendance } from '../enums/attendance.enum';

export class AppointmentResponseDto {
  @ApiProperty({ example: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807' })
  id!: string;

  @ApiProperty({ example: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b' })
  activityId!: string;

  @ApiProperty({ enum: Attendance, example: Attendance.Done })
  attendance!: Attendance;

  @ApiProperty({ example: '2026-12-03' })
  appointmentDate!: string;

  @ApiProperty({ example: '2026-12-03T17:50:00.000Z' })
  createdAt!: string;
}
