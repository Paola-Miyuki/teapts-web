// Este arquivo expõe a consulta do paciente aos documentos que ele mesmo
// enviou (RFDOC007). A conta precisa ser de paciente titular; o service
// confere e filtra pela conta da sessão.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { DocumentListResponseDto } from '../dto/document-list-response.dto';
import { GetDocumentsQueryDto } from '../dto/get-documents-query.dto';
import { DocumentsService } from '../services/documents.service';

@ApiTags('documents')
@Controller('me/documents')
export class MyDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * Lista os documentos que o paciente enviou, paginados, com busca pelo
   * título e filtro por categoria; os excluídos ficam de fora.
   *
   * @param query `q`, `category`, `page` e `limit`
   * @returns a página de documentos
   */
  @Get()
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: page' },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Só o paciente consulta os próprios documentos.',
    },
  })
  async list(
    @Query() query: GetDocumentsQueryDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<DocumentListResponseDto> {
    return this.documents.listMine(account, query);
  }
}
