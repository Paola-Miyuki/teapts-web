// Este arquivo define as respostas do GET /health.

import { ApiProperty } from '@nestjs/swagger';

/** Backend e banco respondendo. */
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ enum: ['up'] })
  database: 'up';
}

/** Backend no ar, mas banco inacessível (503). */
export class HealthDegradedResponseDto {
  @ApiProperty({ enum: ['degraded'] })
  status: 'degraded';

  @ApiProperty({ enum: ['down'] })
  database: 'down';
}
