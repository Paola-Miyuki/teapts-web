// Este arquivo expõe as rotas autenticadas de pacientes: a consulta de
// pacientes autorizados, o cadastro do perfil de paciente (só admin) e os
// contatos de suporte, contato a contato. O ValidationPipe global valida a
// query e o corpo, e o controller delega ao PatientsService.

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
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import { GetAuthorizedPatientsResponseDto } from '../dto/get-authorized-patients-response.dto';
import { GetAvailablePatientsRequestDto } from '../dto/get-available-patients-request.dto';
import { GetAvailablePatientsResponseDto } from '../dto/get-available-patients-response.dto';
import { PatientDetailResponseDto } from '../dto/patient-detail-response.dto';
import { PatientResponseDto } from '../dto/patient-response.dto';
import {
  GetSupportContactsResponseDto,
  SupportContactResponseDto,
} from '../dto/support-contact-response.dto';
import { SupportContactDto } from '../dto/support-contact.dto';
import { UpdateSupportContactRequestDto } from '../dto/update-support-contact-request.dto';
import { PatientsService } from '../services/patients.service';

function invalidParam(name: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: `Parâmetro inválido: ${name}`,
      }),
  });
}

const parsePatientId = invalidParam('patientId');
const parseContactId = invalidParam('contactId');

const SUPPORT_CONTACT_FORBIDDEN = {
  status: 'FORBIDDEN',
  message: 'Acesso restrito ao administrador ou à equipe de um PTS ativo.',
};

const PATIENT_NOT_FOUND = {
  status: 'PATIENT_NOT_FOUND',
  message: 'Paciente não encontrado.',
};

const SUPPORT_CONTACT_NOT_FOUND = {
  status: 'SUPPORT_CONTACT_NOT_FOUND',
  message: 'Contato de suporte não encontrado.',
};

/**
 * Expõe a consulta de pacientes autorizados, o cadastro de perfil de
 * paciente e os contatos de suporte.
 */
@ApiTags('patients')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@Controller()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * Retorna pacientes autorizados, filtrados por PTS ativo e paginados.
   *
   * O accountId é obtido do contexto autenticado, e o responsável do PTS
   * conta como membro da equipe, conforme a RN005. O administrador recebe
   * todos os pacientes cadastrados (RN022).
   *
   * @param account contexto da conta autenticada
   * @param query parâmetros já normalizados
   * @returns pacientes autorizados e dados de paginação
   */
  @Get('patients/authorized')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetAuthorizedPatientsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: limit' },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar os pacientes autorizados.',
    },
  })
  async findAuthorized(
    @CurrentAccount() account: AccountContext,
    @Query() query: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    return this.patientsService.findAuthorized(account, query);
  }

  /**
   * Retorna pacientes sem PTS ativo para criação de uma nova proposta.
   *
   * Diferente de `/patients/authorized`, esta consulta não exige vínculo
   * prévio com um PTS; exige que a conta tenha perfil profissional ou seja de
   * administrador (RN022).
   */
  @Get('patients/available-for-pts')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetAvailablePatientsResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao profissional.',
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar os pacientes disponíveis.',
    },
  })
  async findAvailableForPts(
    @CurrentAccount() account: AccountContext,
    @Query() query: GetAvailablePatientsRequestDto,
  ): Promise<GetAvailablePatientsResponseDto> {
    return this.patientsService.findAvailableForPts(account, query);
  }

  /**
   * Retorna o detalhe de um paciente: o administrador vê qualquer paciente
   * (RN022); o profissional, os pacientes dos PTS de que faz ou fez parte
   * (RN016), só para leitura quando o PTS está encerrado (RN024).
   *
   * @param account contexto da conta autenticada
   * @param id identificador do paciente (a conta)
   * @returns dados do paciente permitidos ao papel
   */
  @Get('patients/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: PatientDetailResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: id' },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao profissional.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado.',
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar o paciente.',
    },
  })
  async findOne(
    @CurrentAccount() account: AccountContext,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            status: 'ERROR',
            message: 'Parâmetro inválido: id',
          }),
      }),
    )
    id: string,
  ): Promise<PatientDetailResponseDto> {
    return this.patientsService.findOne(account, id);
  }

  /**
   * Cria o perfil de paciente de uma conta existente (RFPAC001).
   *
   * @param body conta e contatos de suporte já validados
   * @returns perfil criado
   */
  @Post('patients')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiCreatedResponse({ type: PatientResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe o nome do contato.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: { status: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      ADMIN_ACCOUNT_NOT_ALLOWED: {
        summary: 'Conta de administrador',
        value: {
          status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
          message: 'Conta de administrador não pode ter perfil de paciente.',
        },
      },
      ACCOUNT_HAS_PROFESSIONAL_PROFILE: {
        summary: 'Conta com perfil profissional',
        value: {
          status: 'ACCOUNT_HAS_PROFESSIONAL_PROFILE',
          message: 'A conta já possui um perfil profissional.',
        },
      },
      PATIENT_PROFILE_ALREADY_EXISTS: {
        summary: 'Conta que já tem perfil de paciente',
        value: {
          status: 'PATIENT_PROFILE_ALREADY_EXISTS',
          message: 'A conta já possui perfil de paciente.',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível cadastrar o perfil de paciente.',
    },
  })
  async create(
    @Body() body: CreatePatientRequestDto,
  ): Promise<PatientResponseDto> {
    return this.patientsService.create(body);
  }

  /**
   * Lista os contatos de suporte do paciente (RFPAC003): admin, profissional
   * com vínculo (RN016) e o próprio paciente.
   */
  @Get('patients/:patientId/support-contacts')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetSupportContactsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: patientId',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao profissional.',
    },
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, example: PATIENT_NOT_FOUND })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar os contatos de suporte.',
    },
  })
  async findSupportContacts(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
  ): Promise<GetSupportContactsResponseDto> {
    return this.patientsService.findSupportContacts(account, patientId);
  }

  /**
   * Cria um contato de suporte (RFPAC003): admin ou membro da equipe de um
   * PTS ativo do paciente (RN024). Não concede acesso ao contato (RN017).
   */
  @Post('patients/:patientId/support-contacts')
  @UseGuards(AuthGuard)
  @ApiCreatedResponse({ type: SupportContactResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe o telefone do contato de emergência.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: SUPPORT_CONTACT_FORBIDDEN,
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, example: PATIENT_NOT_FOUND })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível cadastrar o contato de suporte.',
    },
  })
  async createSupportContact(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Body() body: SupportContactDto,
  ): Promise<SupportContactResponseDto> {
    return this.patientsService.createSupportContact(account, patientId, body);
  }

  /**
   * Atualiza um contato de suporte (RFPAC003): os campos ausentes ficam como
   * estão e `null` limpa a descrição, o e-mail ou o telefone.
   */
  @Patch('patients/:patientId/support-contacts/:contactId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: SupportContactResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido para o contato.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: SUPPORT_CONTACT_FORBIDDEN,
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PATIENT_NOT_FOUND: { summary: 'Paciente', value: PATIENT_NOT_FOUND },
      SUPPORT_CONTACT_NOT_FOUND: {
        summary: 'Contato',
        value: SUPPORT_CONTACT_NOT_FOUND,
      },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível atualizar o contato de suporte.',
    },
  })
  async updateSupportContact(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Param('contactId', parseContactId) contactId: string,
    @Body() body: UpdateSupportContactRequestDto,
  ): Promise<SupportContactResponseDto> {
    return this.patientsService.updateSupportContact(
      account,
      patientId,
      contactId,
      body,
    );
  }

  /** Remove um contato de suporte (RFPAC003), com o mesmo acesso do `PATCH`. */
  @Delete('patients/:patientId/support-contacts/:contactId')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: contactId',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: SUPPORT_CONTACT_FORBIDDEN,
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PATIENT_NOT_FOUND: { summary: 'Paciente', value: PATIENT_NOT_FOUND },
      SUPPORT_CONTACT_NOT_FOUND: {
        summary: 'Contato',
        value: SUPPORT_CONTACT_NOT_FOUND,
      },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível remover o contato de suporte.',
    },
  })
  async deleteSupportContact(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Param('contactId', parseContactId) contactId: string,
  ): Promise<void> {
    await this.patientsService.deleteSupportContact(
      account,
      patientId,
      contactId,
    );
  }
}
