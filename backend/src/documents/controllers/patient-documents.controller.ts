// Este arquivo expõe as rotas de documentos de um paciente: por enquanto, o
// pedido da URL de envio (RFDOC001). O ValidationPipe global valida o corpo e
// o controller delega ao DocumentUploadService.

import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { CreateUploadUrlRequestDto } from '../dto/create-upload-url-request.dto';
import { CreateUploadUrlResponseDto } from '../dto/create-upload-url-response.dto';
import { DocumentUploadService } from '../services/document-upload.service';

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
  constructor(private readonly uploads: DocumentUploadService) {}

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
}
