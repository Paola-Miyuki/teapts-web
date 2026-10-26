import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import { PtsService } from '../services/pts.service';

@Controller('pts')
@UseGuards(AuthGuard)
export class PtsController {
  constructor(private readonly ptsService: PtsService) {}

  @Post()
  async create(
    @Body() dto: CreatePtsRequestDto,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.createPts(dto, account.accountId);
  }
}