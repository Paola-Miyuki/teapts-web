import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Session,
} from '@nestjs/common';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import { AuthGuard } from '../auth/guards/auth.guard';
import { TherapeuticPlansService } from './therapeutic-plans.service';
import { CreatePtsRequestDto, CreatePtsResponseDto } from './dto/create-pts.dto';

@Controller('pts')
@UseGuards(AuthGuard)
export class TherapeuticPlansController {
  constructor(
    private readonly therapeuticPlansService: TherapeuticPlansService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPts(
    @Body() dto: CreatePtsRequestDto,
    @Session() session: SessionContainer,
  ): Promise<CreatePtsResponseDto> {
    const authenticatedUserId = session.getUserId();

    return this.therapeuticPlansService.createPts(dto, authenticatedUserId);
  }
}