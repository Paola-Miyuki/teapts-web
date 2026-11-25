// Este arquivo expõe as rotas de documentos de um paciente: o pedido da URL
// de envio (RFDOC001), a confirmação do documento (RFDOC002) e a listagem
// (RFDOC003). O ValidationPipe global valida o corpo e a query, e o controller
// delega aos services.

import {
  BadRequestException,
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
  ApiCreatedResponse,
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
import { DocumentListResponseDto } from '../dto/document-list-response.dto';
import { GetDocumentsQueryDto } from '../dto/get-documents-query.dto';
import { ConfirmDocumentRequestDto } from '../dto/confirm-document-request.dto';
import { DocumentResponseDto } from '../dto/document-response.dto';
import { CreateUploadUrlRequestDto } from '../dto/create-upload-url-request.dto';
import { CreateUploadUrlResponseDto } from '../dto/create-upload-url-response.dto';
import { DocumentUploadService } from '../services/document-upload.service';
import { DocumentsService } from '../services/documents.service';

const parsePatientId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('documents')
@Controller()
export class PatientDocumentsController {
  constructor(
    private readonly uploads: DocumentUploadService,
    private readonly documents: DocumentsService,
  ) {}

  /**
   * Lista os documentos do paciente (RFDOC003), paginados, com busca pelo
   * título e filtro por categoria; os excluídos ficam de fora.
   *
   * @param patientId paciente dono dos documentos
   * @param query `q`, `category`, `page` e `limit`
   * @returns a página de documentos
   */
  @Get('patients/:id/documents')
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
      message: 'Você não tem acesso aos documentos deste paciente.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado.',
    },
  })
  async listDocuments(
    @Param('id', parsePatientId) patientId: string,
    @Query() query: GetDocumentsQueryDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<DocumentListResponseDto> {
    return this.documents.list(account, patientId, query);
  }

  /**
   * Pede a URL temporária para enviar um documento do paciente (RFDOC001).
   *
   * @param patientId paciente dono do documento
   * @param body nome, tipo e tamanho do arquivo
   * @returns `uploadUrl`, `fileKey` e `expiresAt`
   */
  @Post('patients/:id/documents/upload-url')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: CreateUploadUrlResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      FILE_TYPE_NOT_ALLOWED: {
        summary: 'FILE_TYPE_NOT_ALLOWED',
        value: {
          status: 'FILE_TYPE_NOT_ALLOWED',
          message:
            'Tipo de arquivo não permitido. Envie PDF, PNG, JPG, DOC ou DOCX.',
        },
      },
      FILE_TOO_LARGE: {
        summary: 'FILE_TOO_LARGE',
        value: {
          status: 'FILE_TOO_LARGE',
          message: 'O arquivo deve ter no máximo 5 MB.',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Você não tem acesso aos documentos deste paciente.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado.',
    },
  })
  async createUploadUrl(
    @Param('id', parsePatientId) patientId: string,
    @Body() body: CreateUploadUrlRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<CreateUploadUrlResponseDto> {
    return this.uploads.createUploadUrl(account, patientId, body);
  }

  /**
   * Confirma o documento depois do envio (RFDOC002): grava os metadados e
   * ativa o objeto. Repetir a `fileKey` devolve o documento já criado.
   *
   * @param patientId paciente dono do documento
   * @param body `fileKey` e metadados
   * @returns o documento confirmado
   */
  @Post('patients/:id/documents')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      VALIDATION_ERROR: {
        summary: 'VALIDATION_ERROR',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Informe o título.',
        },
      },
      UPLOAD_NOT_FOUND: {
        summary: 'UPLOAD_NOT_FOUND',
        value: {
          status: 'UPLOAD_NOT_FOUND',
          message:
            'O arquivo não foi encontrado no storage. Envie-o novamente.',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Você não tem acesso aos documentos deste paciente.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado.',
    },
  })
  async confirmDocument(
    @Param('id', parsePatientId) patientId: string,
    @Body() body: ConfirmDocumentRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<DocumentResponseDto> {
    return this.documents.confirm(account, patientId, body);
  }
}
