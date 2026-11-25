// Este arquivo expõe as rotas de um documento: a URL temporária de leitura
// (RFDOC003). O acesso é conferido pelo service, pelo paciente dono do
// documento.

import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import type { AccountContext } from '../../accounts/services/accounts.service';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { DocumentUrlResponseDto } from '../dto/document-url-response.dto';
import { DocumentsService } from '../services/documents.service';

const parseDocumentId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * Gera a URL temporária de leitura do arquivo (RFDOC003, RFDOC007): a
   * equipe pelo vínculo com o paciente; o paciente, só dos documentos que ele
   * enviou. Documento excluído não tem URL.
   *
   * @param documentId documento ativo
   * @returns a `url` do backend com o token de leitura e o `expiresAt`
   */
  @Get(':id/url')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentUrlResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'VALIDATION_ERROR', message: 'Parâmetro inválido: id' },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    examples: {
      FORBIDDEN: {
        summary: 'FORBIDDEN',
        value: {
          status: 'FORBIDDEN',
          message: 'Você não tem acesso aos documentos deste paciente.',
        },
      },
      OWN_DOCUMENTS_ONLY: {
        summary: 'FORBIDDEN (paciente)',
        value: {
          status: 'FORBIDDEN',
          message: 'Você só acessa os documentos que enviou.',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      DOCUMENT_NOT_FOUND: {
        summary: 'DOCUMENT_NOT_FOUND',
        value: {
          status: 'DOCUMENT_NOT_FOUND',
          message: 'Documento não encontrado.',
        },
      },
      PATIENT_NOT_FOUND: {
        summary: 'PATIENT_NOT_FOUND',
        value: {
          status: 'PATIENT_NOT_FOUND',
          message: 'Paciente não encontrado.',
        },
      },
    },
  })
  async getUrl(
    @Param('id', parseDocumentId) documentId: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<DocumentUrlResponseDto> {
    return this.documents.getUrl(account, documentId);
  }
}
