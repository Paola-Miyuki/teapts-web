import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConflictResponse,
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
import { GetActivePtsQueryDto } from '../dto/get-active-pts-query.dto';
import { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import {
  GetPtsProposalsResponseDto,
  PtsProposalResponseDto,
} from '../dto/pts-proposal-response.dto';
import { UpdatePtsProposalRequestDto } from '../dto/update-pts-proposal.dto';
import {
  UpdateSocialSituationRequestDto,
  UpdateSocialSituationResponseDto,
} from '../dto/update-social-situation.dto';
import { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import { PtsService } from '../services/pts.service';

const parseProposalId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

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
    return this.ptsService.createPts(dto, account);
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
    @Param('id', parseProposalId) id: string,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.findDraftProposalById(id, account);
  }

  @Get('active')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: ActivePtsResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async findActive(
    @Query() query: GetActivePtsQueryDto,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.findActivePts(query, account);
  }

  @Patch('proposals/:id')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: PtsProposalResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async updateProposal(
    @Param('id', parseProposalId) id: string,
    @Body() dto: UpdatePtsProposalRequestDto,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.updatePtsProposal(id, dto, account);
  }

  @Patch(':id/social-situation')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: UpdateSocialSituationResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async updateSocialSituation(
    @Param('id', parseProposalId) id: string,
    @Body() dto: UpdateSocialSituationRequestDto,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.updateSocialSituation(id, dto, account);
  }

  @Post('proposals/:id/approve')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PtsDecisionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async approveProposal(
    @Param('id', parseProposalId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<PtsDecisionResponseDto> {
    return this.ptsService.approveProposal(id, account);
  }

  @Post('proposals/:id/reject')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PtsDecisionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async rejectProposal(
    @Param('id', parseProposalId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<PtsDecisionResponseDto> {
    return this.ptsService.rejectProposal(id, account);
  }
}
