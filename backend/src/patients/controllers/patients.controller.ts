// Este arquivo expÃµe as rotas autenticadas de pacientes: a consulta de
// pacientes autorizados, o cadastro do perfil de paciente (sÃ³ admin) e os
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
import { ClinicalDataResponseDto } from '../dto/clinical-data-response.dto';
import { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import { GetAuthorizedPatientsResponseDto } from '../dto/get-authorized-patients-response.dto';
import { GetEligiblePatientsRequestDto } from '../dto/get-eligible-patients-request.dto';
import { GetEligiblePatientsResponseDto } from '../dto/get-eligible-patients-response.dto';
import { MedicationRequestDto } from '../dto/medication-request.dto';
import {
  GetMedicationsResponseDto,
  MedicationResponseDto,
} from '../dto/medication-response.dto';
import { PatientDetailResponseDto } from '../dto/patient-detail-response.dto';
import { PatientResponseDto } from '../dto/patient-response.dto';
import {
  GetSupportContactsResponseDto,
  SupportContactResponseDto,
} from '../dto/support-contact-response.dto';
import { SupportContactDto } from '../dto/support-contact.dto';
import { UpdateClinicalDataRequestDto } from '../dto/update-clinical-data-request.dto';
import { UpdateSupportContactRequestDto } from '../dto/update-support-contact-request.dto';
import { PatientsService } from '../services/patients.service';

function invalidParam(name: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: `ParÃ¢metro invÃ¡lido: ${name}`,
      }),
  });
}

const parsePatientId = invalidParam('patientId');
const parseContactId = invalidParam('contactId');
const parseMedicationId = invalidParam('medicationId');

const SUPPORT_CONTACT_FORBIDDEN = {
  status: 'FORBIDDEN',
  message: 'Acesso restrito ao administrador ou Ã  equipe de um PTS ativo.',
};

const PATIENT_NOT_FOUND = {
  status: 'PATIENT_NOT_FOUND',
  message: 'Paciente nÃ£o encontrado.',
};

const SUPPORT_CONTACT_NOT_FOUND = {
  status: 'SUPPORT_CONTACT_NOT_FOUND',
  message: 'Contato de suporte nÃ£o encontrado.',
};

/**
 * ExpÃµe a consulta de pacientes autorizados, o cadastro de perfil de
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
   * O accountId Ã© obtido do contexto autenticado, e o responsÃ¡vel do PTS
   * conta como membro da equipe, conforme a RN005. O administrador recebe
   * todos os pacientes cadastrados (RN022).
   *
   * @param account contexto da conta autenticada
   * @param query parÃ¢metros jÃ¡ normalizados
   * @returns pacientes autorizados e dados de paginaÃ§Ã£o
   */
  @Get('patients/authorized')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetAuthorizedPatientsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'ParÃ¢metro invÃ¡lido: limit' },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'NÃ£o foi possÃ­vel consultar os pacientes autorizados.',
    },
  })
  async findAuthorized(
    @CurrentAccount() account: AccountContext,
    @Query() query: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    return this.patientsService.findAuthorized(account, query);
  }

  /**
   * Busca os pacientes elegÃ­veis para uma nova proposta de PTS (RFPTS001):
   * sem PTS em planejamento ou em andamento e sem rascunho (RN011), por nome,
   * nome social, e-mail ou CPF (NFUS003). O CPF nÃ£o volta na resposta (DP011).
   *
   * Diferente de `/patients/authorized`, nÃ£o exige vÃ­nculo prÃ©vio com um PTS;
   * exige conta com perfil profissional ou de administrador (RN029).
   */
  @Get('patients')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetEligiblePatientsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'ParÃ¢metro invÃ¡lido: withActivePts' },
  })
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
      message: 'NÃ£o foi possÃ­vel consultar os pacientes elegÃ­veis.',
    },
  })
  async findEligibleForProposal(
    @CurrentAccount() account: AccountContext,
    @Query() query: GetEligiblePatientsRequestDto,
  ): Promise<GetEligiblePatientsResponseDto> {
    return this.patientsService.findEligibleForProposal(account, query);
  }

  /**
   * Retorna o detalhe de um paciente: o administrador vÃª qualquer paciente
   * (RN022); o profissional, os pacientes dos PTS de que faz ou fez parte
   * (RN016), sÃ³ para leitura quando o PTS estÃ¡ encerrado (RN024).
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
    example: { status: 'ERROR', message: 'ParÃ¢metro invÃ¡lido: id' },
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
      message: 'Paciente nÃ£o encontrado.',
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'NÃ£o foi possÃ­vel consultar o paciente.',
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
            message: 'ParÃ¢metro invÃ¡lido: id',
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
   * @param body conta e contatos de suporte jÃ¡ validados
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
    example: { status: 'ACCOUNT_NOT_FOUND', message: 'Conta nÃ£o encontrada.' },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      ADMIN_ACCOUNT_NOT_ALLOWED: {
        summary: 'Conta de administrador',
        value: {
          status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
          message: 'Conta de administrador nÃ£o pode ter perfil de paciente.',
        },
      },
      ACCOUNT_HAS_PROFESSIONAL_PROFILE: {
        summary: 'Conta com perfil profissional',
        value: {
          status: 'ACCOUNT_HAS_PROFESSIONAL_PROFILE',
          message: 'A conta jÃ¡ possui um perfil profissional.',
        },
      },
      PATIENT_PROFILE_ALREADY_EXISTS: {
        summary: 'Conta que jÃ¡ tem perfil de paciente',
        value: {
          status: 'PATIENT_PROFILE_ALREADY_EXISTS',
          message: 'A conta jÃ¡ possui perfil de paciente.',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'NÃ£o foi possÃ­vel cadastrar o perfil de paciente.',
    },
  })
  async create(
    @Body() body: CreatePatientRequestDto,
  ): Promise<PatientResponseDto> {
    return this.patientsService.create(body);
  }


  /**
   * Atualiza historico clinico e alergias do paciente (RFPAC007).
   */
  @Patch('patients/:patientId/clinical-data')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ClinicalDataResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Dados clinicos invalidos.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador ou a equipe de um PTS ativo.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente nao encontrado.',
    },
  })
  async updateClinicalData(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Body() body: UpdateClinicalDataRequestDto,
  ): Promise<ClinicalDataResponseDto> {
    return this.patientsService.updateClinicalData(
      account,
      patientId,
      body,
    );
  }

  /**
   * Lista as medicacoes do paciente.
   */
  @Get('patients/:patientId/medications')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetMedicationsResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso negado ao paciente.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente nao encontrado.',
    },
  })
  async findMedications(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
  ): Promise<GetMedicationsResponseDto> {
    return this.patientsService.findMedications(account, patientId);
  }

  /**
   * Cadastra uma medicacao do paciente.
   */
  @Post('patients/:patientId/medications')
  @UseGuards(AuthGuard)
  @ApiCreatedResponse({ type: MedicationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Medicamento, dose, frequencia e inicio sao obrigatorios.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador ou a equipe de um PTS ativo.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente nao encontrado.',
    },
  })
  async createMedication(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Body() body: MedicationRequestDto,
  ): Promise<MedicationResponseDto> {
    return this.patientsService.createMedication(
      account,
      patientId,
      body,
    );
  }

  /**
   * Atualiza uma medicacao existente.
   */
  @Patch('patients/:patientId/medications/:medicationId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MedicationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Dados da medicacao invalidos.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador ou a equipe de um PTS ativo.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PATIENT_NOT_FOUND: {
        summary: 'Paciente',
        value: {
          status: 'PATIENT_NOT_FOUND',
          message: 'Paciente nao encontrado.',
        },
      },
      MEDICATION_NOT_FOUND: {
        summary: 'Medicacao',
        value: {
          status: 'MEDICATION_NOT_FOUND',
          message: 'Medicacao nao encontrada.',
        },
      },
    },
  })
  async updateMedication(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Param('medicationId', parseMedicationId) medicationId: string,
    @Body() body: MedicationRequestDto,
  ): Promise<MedicationResponseDto> {
    return this.patientsService.updateMedication(
      account,
      patientId,
      medicationId,
      body,
    );
  }

  /**
   * Suspende uma medicacao sem apagar o registro.
   */
  @Post('patients/:patientId/medications/:medicationId/stop')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MedicationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'A data de fim nao pode ser anterior a data de inicio.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador ou a equipe de um PTS ativo.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PATIENT_NOT_FOUND: {
        summary: 'Paciente',
        value: {
          status: 'PATIENT_NOT_FOUND',
          message: 'Paciente nao encontrado.',
        },
      },
      MEDICATION_NOT_FOUND: {
        summary: 'Medicacao',
        value: {
          status: 'MEDICATION_NOT_FOUND',
          message: 'Medicacao nao encontrada.',
        },
      },
    },
  })
  async stopMedication(
    @CurrentAccount() account: AccountContext,
    @Param('patientId', parsePatientId) patientId: string,
    @Param('medicationId', parseMedicationId) medicationId: string,
  ): Promise<MedicationResponseDto> {
    return this.patientsService.stopMedication(
      account,
      patientId,
      medicationId,
    );
  }
  /**
   * Lista os contatos de suporte do paciente (RFPAC003): admin, profissional
   * com vÃ­nculo (RN016) e o prÃ³prio paciente.
   */
  @Get('patients/:patientId/support-contacts')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: GetSupportContactsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'ParÃ¢metro invÃ¡lido: patientId',
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
      message: 'NÃ£o foi possÃ­vel consultar os contatos de suporte.',
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
   * PTS ativo do paciente (RN024). NÃ£o concede acesso ao contato (RN017).
   */
  @Post('patients/:patientId/support-contacts')
  @UseGuards(AuthGuard)
  @ApiCreatedResponse({ type: SupportContactResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe o telefone do contato de emergÃªncia.',
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
      message: 'NÃ£o foi possÃ­vel cadastrar o contato de suporte.',
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
   * estÃ£o e `null` limpa a descriÃ§Ã£o, o e-mail ou o telefone.
   */
  @Patch('patients/:patientId/support-contacts/:contactId')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: SupportContactResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail vÃ¡lido para o contato.',
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
      message: 'NÃ£o foi possÃ­vel atualizar o contato de suporte.',
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
      message: 'ParÃ¢metro invÃ¡lido: contactId',
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
      message: 'NÃ£o foi possÃ­vel remover o contato de suporte.',
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


