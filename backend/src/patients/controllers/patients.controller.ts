// Este arquivo expõe as rotas autenticadas de pacientes: a consulta de
// pacientes autorizados, o cadastro do perfil de paciente (só admin) e a
// consulta e atualização dos contatos de suporte (admin ou o próprio
// paciente). O ValidationPipe global valida a query e o corpo, e o controller
// delega ao PatientsService.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { PatientResponseDto } from '../dto/patient-response.dto';
import { UpdateSupportContactsRequestDto } from '../dto/update-support-contacts-request.dto';
import { PatientsService } from '../services/patients.service';

const parsePatientId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: patientId',
    }),
});

const SUPPORT_CONTACTS_FORBIDDEN_EXAMPLE = {
  status: 'FORBIDDEN',
  message: 'Acesso restrito ao administrador ou ao próprio paciente.',
};

const PATIENT_NOT_FOUND_EXAMPLE = {
  status: 'PATIENT_NOT_FOUND',
  message: 'Paciente não encontrado.',
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
  @ApiOkResponse({ type: GetAuthorizedPatientsResponseDto })
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
    @Query() query: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    return this.patientsService.findAvailableForPts(account, query);
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
   * Consulta os contatos de suporte do paciente (RFPAC003). Só o admin ou o
   * próprio paciente.
   *
   * @param account contexto da conta autenticada
   * @param patientId accountId do perfil de paciente
   * @returns perfil com os contatos atuais
   */
  @Get('patients/:patientId/support-contacts')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: patientId',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: SUPPORT_CONTACTS_FORBIDDEN_EXAMPLE,
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: PATIENT_NOT_FOUND_EXAMPLE,
  })
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
  ): Promise<PatientResponseDto> {
    return this.patientsService.findSupportContacts(account, patientId);
  }

  /**
   * Substitui a lista inteira de contatos de suporte do paciente (RFPAC003,
   * DP012); lista vazia remove todos. Só o admin ou o próprio paciente.
   * Contato de suporte não concede tutela nem acesso clínico (RN017).
   *
   * @param account contexto da conta autenticada
   * @param patientId accountId do perfil de paciente
   * @param body lista nova de contatos, já validada
   * @returns perfil com os contatos gravados
   */
  @Put('patients/:patientId/support-contacts')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      INVALID_PATIENT_ID: {
        summary: 'patientId que não é UUID',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Parâmetro inválido: patientId',
        },
      },
      INVALID_PHONE: {
        summary: 'Contato com telefone inválido',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Informe um telefone válido para o contato.',
        },
      },
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: SUPPORT_CONTACTS_FORBIDDEN_EXAMPLE,
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: PATIENT_NOT_FOUND_EXAMPLE,
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível atualizar os contatos de suporte.',
    },
  })
  async updateSupportContacts(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Body() body: UpdateSupportContactsRequestDto,
  ): Promise<PatientResponseDto> {
    return this.patientsService.updateSupportContacts(account, patientId, body);
  }
}
