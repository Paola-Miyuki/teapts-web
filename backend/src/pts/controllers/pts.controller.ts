import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import { GetPtsProposalsQueryDto } from '../dto/get-pts-proposals-query.dto';
import {
  GetPtsProposalsResponseDto,
  PtsProposalResponseDto,
} from '../dto/pts-proposal-response.dto';
import { PtsService } from '../services/pts.service';

@ApiTags('pts')
@Controller('pts')
export class PtsController {
  constructor(private readonly ptsService: PtsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async create(
    @Body() dto: CreatePtsRequestDto,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.createPts(dto, account.accountId);
  }

  @Get('proposals')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: GetPtsProposalsResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async findDraftProposals(
    @Query() query: GetPtsProposalsQueryDto,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.findDraftProposals(query, account);
  }

  @Get('proposals/:id')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: PtsProposalResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async findDraftProposalById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.findDraftProposalById(id, account);
  }
}