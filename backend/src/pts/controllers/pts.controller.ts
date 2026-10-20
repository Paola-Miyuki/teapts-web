
import { Body, Controller, Post } from '@nestjs/common';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import { PtsService } from '../services/pts.service';

@Controller('pts')
export class PtsController {
  constructor(private readonly ptsService: PtsService) {}

  @Post()
  async create(
    @Body() dto: CreatePtsRequestDto,
    @CurrentAccount() accountId: string,
  ) {
    return this.ptsService.createPts(dto, accountId);
  }
}
