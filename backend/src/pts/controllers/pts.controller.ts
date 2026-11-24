import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  ApiOperation,
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
import { TransferPtsResponsibilityRequestDto } from '../dto/transfer-pts-responsibility.dto';
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
import { PtsTeamResponseDto } from '../dto/pts-team-response.dto';
import { DeletePtsProposalResponseDto } from '../dto/delete-pts-proposal-response.dto';
import { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
import { AddPtsTeamMembersRequestDto } from '../dto/add-pts-team-members.dto';
import { PtsService } from '../services/pts.service';

const parseUuidParam = (name: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: `Parâmetro inválido: ${name}`,
      }),
  });

const parseProposalId = parseUuidParam('id');
const parseProfessionalId = parseUuidParam('professionalId');

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

  /** PTS em qualquer estado, pelo id (RFPTS009). Fica depois das rotas fixas. */
  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: PtsDetailResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async findById(
    @Param('id', parseProposalId) id: string,
    @CurrentAccount() account: AccountContext,
  ) {
    return this.ptsService.findPtsById(id, account);
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

  @Delete('proposals/:id')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exclui uma proposta de PTS em DRAFT (RFPTS008)',
    description:
      'Exclusão lógica (deletedAt): só o responsável (ou o admin) exclui. ' +
      'A proposta deixa de aparecer em GET /pts/proposals e GET /pts/proposals/:id.',
  })
  @ApiOkResponse({ type: DeletePtsProposalResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_DRAFT: {
        summary: 'Proposta que não está em draft',
        value: {
          status: 'PTS_NOT_DRAFT',
          message: 'Somente propostas aguardando decisão podem ser excluídas.',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async deleteProposal(
    @Param('id', parseProposalId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<DeletePtsProposalResponseDto> {
    return this.ptsService.deleteProposal(id, account);
  }

  @Post(':id/team')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Adiciona profissionais à equipe multidisciplinar de um PTS ativo (RFEM001)',
    description:
      'Somente o profissional responsável adiciona perfis cadastrados a um PTS em PLANNING ou RUNNING. ' +
      'Cada conta participa com no máximo um perfil, contando o responsável (RN008). ' +
      'Os vínculos e um evento member_added por profissional entram na mesma transação.',
  })
  @ApiOkResponse({ type: PtsTeamResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      VALIDATION_ERROR: {
        summary: 'Payload ou parâmetro inválido',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Dados inválidos na solicitação.',
        },
      },
      TEAM_PROFESSIONAL_NOT_FOUND: {
        summary: 'Perfil profissional inexistente',
        value: {
          status: 'TEAM_PROFESSIONAL_NOT_FOUND',
          message:
            'Profissionais da equipe não encontrados: 5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a.',
          professionalIds: ['5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'],
        },
      },
      TEAM_DUPLICATE_ACCOUNT: {
        summary: 'Conta já presente na equipe ou como responsável',
        value: {
          status: 'TEAM_DUPLICATE_ACCOUNT',
          message:
            'A equipe não pode ter mais de um perfil da mesma conta, contando o responsável.',
          professionalIds: ['5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    examples: {
      FORBIDDEN: {
        summary: 'Conta sem o perfil responsável pelo PTS',
        value: {
          status: 'FORBIDDEN',
          message: 'Somente o responsável pode alterar a equipe do PTS.',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_FOUND: {
        summary: 'PTS não encontrado',
        value: {
          status: 'PTS_NOT_FOUND',
          message: 'PTS não encontrado.',
        },
      },
    },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_ACTIVE: {
        summary: 'PTS não está em PLANNING ou RUNNING',
        value: {
          status: 'PTS_NOT_ACTIVE',
          message: 'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
        },
      },
    },
  })
  async addTeamMembers(
    @Param('id', parseProposalId) id: string,
    @Body() dto: AddPtsTeamMembersRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<PtsTeamResponseDto> {
    return this.ptsService.addTeamMembers(id, dto, account);
  }

  @Delete(':id/team/:professionalId')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove um profissional da equipe do PTS (RFEM003)',
    description:
      'Só o responsável (ou o admin) remove; o PTS deve estar em planning ou running. ' +
      'O vínculo sai e o evento é gravado na timeline na mesma transação.',
  })
  @ApiOkResponse({ type: PtsTeamResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_FOUND: {
        summary: 'PTS inexistente',
        value: { status: 'PTS_NOT_FOUND', message: 'PTS não encontrado.' },
      },
      TEAM_MEMBER_NOT_FOUND: {
        summary: 'Profissional fora da equipe',
        value: {
          status: 'TEAM_MEMBER_NOT_FOUND',
          message: 'O profissional não faz parte da equipe deste PTS.',
        },
      },
    },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_ACTIVE: {
        summary: 'PTS fora de planning e running',
        value: {
          status: 'PTS_NOT_ACTIVE',
          message: 'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
        },
      },
      CANNOT_REMOVE_RESPONSIBLE: {
        summary: 'Tentativa de remover o responsável',
        value: {
          status: 'CANNOT_REMOVE_RESPONSIBLE',
          message:
            'O responsável não pode ser removido da equipe. Transfira a responsabilidade antes.',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async removeTeamMember(
    @Param('id', parseProposalId) id: string,
    @Param('professionalId', parseProfessionalId) professionalId: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<PtsTeamResponseDto> {
    return this.ptsService.removeTeamMember(id, professionalId, account);
  }

  @Post(':id/team/transfer-responsibility')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Transfere a responsabilidade de um PTS ativo para outro profissional (RFEM002)',
    description:
      'Somente o profissional responsável atual (ou o admin) transfere a responsabilidade ' +
      'de um PTS em PLANNING ou RUNNING para outro perfil profissional cadastrado e ativo (RN006, RN007). ' +
      'O responsável anterior sai da equipe, o substituto assume e seu vínculo anterior como membro (se houver) é removido na mesma transação.',
  })
  @ApiOkResponse({ type: PtsTeamResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      VALIDATION_ERROR: {
        summary: 'Payload ou parâmetro inválido',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Dados inválidos na solicitação.',
        },
      },
      NEW_RESPONSIBLE_NOT_FOUND: {
        summary: 'Substituto não cadastrado',
        value: {
          status: 'NEW_RESPONSIBLE_NOT_FOUND',
          message:
            'O profissional indicado para assumir a responsabilidade não está cadastrado.',
        },
      },
      NEW_RESPONSIBLE_INVALID: {
        summary: 'Substituto inválido ou igual ao responsável atual',
        value: {
          status: 'NEW_RESPONSIBLE_INVALID',
          message:
            'O profissional indicado para assumir a responsabilidade é inválido ou já é o responsável atual.',
        },
      },
      TEAM_DUPLICATE_ACCOUNT: {
        summary: 'Conta do substituto já presente em outro membro da equipe',
        value: {
          status: 'TEAM_DUPLICATE_ACCOUNT',
          message:
            'A equipe não pode ter mais de um perfil da mesma conta, contando o responsável.',
          professionalIds: ['5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    examples: {
      FORBIDDEN: {
        summary: 'Conta sem o perfil responsável pelo PTS',
        value: {
          status: 'FORBIDDEN',
          message: 'Somente o responsável pode alterar a equipe do PTS.',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_FOUND: {
        summary: 'PTS não encontrado',
        value: {
          status: 'PTS_NOT_FOUND',
          message: 'PTS não encontrado.',
        },
      },
    },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_ACTIVE: {
        summary: 'PTS não está em PLANNING ou RUNNING',
        value: {
          status: 'PTS_NOT_ACTIVE',
          message: 'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
        },
      },
    },
  })
  async transferResponsibility(
    @Param('id', parseProposalId) id: string,
    @Body() dto: TransferPtsResponsibilityRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<PtsTeamResponseDto> {
    return this.ptsService.transferResponsibility(id, dto, account);
  }
}
