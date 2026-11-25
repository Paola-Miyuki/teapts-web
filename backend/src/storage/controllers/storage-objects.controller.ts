// Este arquivo expõe o envio do arquivo ao storage simulado no Postgres
// (`PUT /storage/objects/:fileKey?token=...`). Não usa o AuthGuard: a
// autorização é o token assinado da URL, válido só para aquele objeto, aquele
// tipo de arquivo e até o vencimento.

import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ErrorResponseDto } from '../../common/swagger/error-response.dto';
import {
  fileTooLarge,
  fileTypeNotAllowed,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
} from '../file-policy';
import { StorageTokenService } from '../services/storage-token.service';
import {
  StorageObjectAlreadyExistsError,
  StorageService,
} from '../storage.service';

/** Lê o corpo da requisição, parando ao passar do limite de 5 MB. */
async function readBody(request: Request): Promise<Buffer> {
  const declared = Number(request.headers['content-length']);

  if (declared > MAX_FILE_SIZE_BYTES) {
    throw fileTooLarge();
  }

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;

    if (size > MAX_FILE_SIZE_BYTES) {
      throw fileTooLarge();
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

@ApiTags('storage')
@Controller()
export class StorageObjectsController {
  constructor(
    private readonly tokens: StorageTokenService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Grava o arquivo enviado pela `uploadUrl` (RFDOC001). O objeto fica não
   * ativo até a confirmação do documento (RFDOC002).
   *
   * @param fileKey chave do objeto, igual à do token
   * @param token token assinado da URL
   * @param contentType tipo do arquivo, igual ao pedido da URL
   */
  @Put('storage/objects/:fileKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Arquivo gravado.' })
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
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'UPLOAD_URL_INVALID',
      message: 'A URL de envio é inválida ou venceu.',
    },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FILE_ALREADY_UPLOADED',
      message: 'O arquivo já foi enviado.',
    },
  })
  async put(
    @Param('fileKey') fileKey: string,
    @Query('token') token: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Req() request: Request,
  ): Promise<void> {
    // O tipo vem sem parâmetros (`; charset=...`) e minúsculo.
    const mimeType = (contentType ?? '').split(';')[0].trim().toLowerCase();

    if (!token || !this.tokens.verify(token, fileKey, 'write', { mimeType })) {
      throw new ForbiddenException({
        status: 'UPLOAD_URL_INVALID',
        message: 'A URL de envio é inválida ou venceu.',
      });
    }

    // Só tipos permitidos: o JSON e o formulário seriam lidos pelo parser
    // global antes deste método.
    if (!isAllowedMimeType(mimeType)) {
      throw fileTypeNotAllowed();
    }

    const content = await readBody(request);

    if (content.length === 0) {
      throw new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: 'O arquivo está vazio.',
      });
    }

    try {
      await this.storage.putObject({ fileKey, mimeType, content });
    } catch (error) {
      if (error instanceof StorageObjectAlreadyExistsError) {
        throw new ConflictException({
          status: 'FILE_ALREADY_UPLOADED',
          message: 'O arquivo já foi enviado.',
        });
      }

      throw error;
    }
  }
}
