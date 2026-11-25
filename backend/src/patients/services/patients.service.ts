// Este arquivo concentra as regras de pacientes: a consulta de pacientes
// autorizados e o cadastro do perfil de paciente.
// A query da consulta fica no PatientsRepository; aqui ficam o erro seguro, a
// conversão para o contrato público e os metadados da paginação.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { isAdmin } from '../../auth/account-context';
import { toPagination } from '../../common/pagination/pagination';
import { REVIEW_TIME_ZONE } from '../../notifications/services/review-window.service';
import type { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type {
  AuthorizedPatientResponseDto,
  GetAuthorizedPatientsResponseDto,
} from '../dto/get-authorized-patients-response.dto';
import type { GetEligiblePatientsRequestDto } from '../dto/get-eligible-patients-request.dto';
import type { GetEligiblePatientsResponseDto } from '../dto/get-eligible-patients-response.dto';
import type {
  PatientDetailResponseDto,
  PatientDiagnosisResponseDto,
  PatientReassessmentResponseDto,
} from '../dto/patient-detail-response.dto';
import type { PatientResponseDto } from '../dto/patient-response.dto';
import type { ClinicalDataResponseDto } from '../dto/clinical-data-response.dto';
import type { MedicationRequestDto } from '../dto/medication-request.dto';
import type {
  GetMedicationsResponseDto,
  MedicationResponseDto,
} from '../dto/medication-response.dto';
import type { UpdateClinicalDataRequestDto } from '../dto/update-clinical-data-request.dto';
import type { Medication } from '../entities/medication.entity';
import type { SupportContact } from '../entities/support-contact.entity';
import {
  type SupportContactChannels,
  type SupportContactDto,
  supportContactChannelError,
} from '../dto/support-contact.dto';
import type {
  GetSupportContactsResponseDto,
  SupportContactResponseDto,
} from '../dto/support-contact-response.dto';
import type { UpdateSupportContactRequestDto } from '../dto/update-support-contact-request.dto';
import {
  ACTIVE_PTS_STATES,
  type ClinicalDataValues,
  type CurrentPtsRow,
  type EligiblePatientsPage,
  type PatientDetailRow,
  type PatientRow,
  type MedicationValues,
  type PatientScope,
  type PatientsPage,
  PatientsRepository,
  type SupportContactValues,
} from '../repositories/patients.repository';

/** Código do Postgres para violação de chave única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

const OPTIONAL_CONTACT_FIELDS = ['description', 'email', 'phone'] as const;

// A janela de reavaliação abre 30 dias antes da próxima revisão (RN031).
const REVIEW_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Diagnóstico em comum do PTS atual (RN030). */
function toDiagnosis(pts: CurrentPtsRow): PatientDiagnosisResponseDto {
  return {
    ptsId: pts.id,
    ptsStatus: pts.status,
    caseStudyDate: pts.caseStudyDate,
    cid: pts.cid,
    supportLevel: pts.supportLevel,
    summary: pts.diagnosisSummary,
    strengths: pts.strengths,
    priorityNeeds: pts.priorityNeeds,
    socialSituation: pts.socialSituation,
  };
}

/**
 * Selo de reavaliação do PTS ativo: `open` de 30 dias antes da próxima revisão
 * até a data, `overdue` depois dela; fora disso, ou sem PTS ativo, `null`.
 */
export function toReassessment(
  pts: CurrentPtsRow,
  now = new Date(),
): PatientReassessmentResponseDto | null {
  if (!ACTIVE_PTS_STATES.includes(pts.status)) {
    return null;
  }

  // en-CA formata em yyyy-mm-dd.
  const today = now.toLocaleDateString('en-CA', { timeZone: REVIEW_TIME_ZONE });
  const days = Math.round(
    (Date.parse(pts.nextReviewAt) - Date.parse(today)) / DAY_MS,
  );

  if (days < 0) {
    return { status: 'overdue', nextReviewAt: pts.nextReviewAt };
  }

  return days <= REVIEW_WINDOW_DAYS
    ? { status: 'open', nextReviewAt: pts.nextReviewAt }
    : null;
}

/** Erro `409` de conta que já tem perfil de paciente (RN002). */
function patientProfileAlreadyExists(): ConflictException {
  return new ConflictException({
    status: 'PATIENT_PROFILE_ALREADY_EXISTS',
    message: 'A conta já possui perfil de paciente.',
  });
}

/** Diz se o erro do banco é uma violação de chave única. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: unknown } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
}

/**
 * Monta o contato salvo no banco: textos sem espaços externos e sem os
 * campos opcionais vazios.
 */
function toSupportContact(contact: SupportContactDto): SupportContactDto {
  const normalized: SupportContactDto = { name: contact.name.trim() };

  for (const field of OPTIONAL_CONTACT_FIELDS) {
    const value = contact[field]?.trim();

    if (value) {
      normalized[field] = value;
    }
  }

  normalized.isEmergency = contact.isEmergency ?? false;

  return normalized;
}

/**
 * Consulta pacientes autorizados e cadastra perfis de paciente.
 */
function forbiddenPatient(): ForbiddenException {
  return new ForbiddenException({
    status: 'FORBIDDEN',
    message: 'Acesso restrito ao profissional.',
  });
}

/**
 * Escopo de quem consulta: o administrador vê todos (RN022); o profissional,
 * os pacientes dos PTS de que faz ou fez parte (RN016). Conta sem perfil
 * profissional, que não seja de administrador, recebe 403 (RFPAC002.E04).
 */
function patientScope(account: AccountContext): PatientScope {
  if (isAdmin(account)) {
    return { kind: 'all' };
  }

  if (account.professionalProfileIds.length === 0) {
    throw forbiddenPatient();
  }

  return { kind: 'professional', accountId: account.accountId };
}

function toSupportContactResponse(
  contact: SupportContact,
): SupportContactResponseDto {
  return {
    id: contact.id,
    name: contact.name,
    description: contact.description,
    email: contact.email,
    phone: contact.phone,
    isEmergency: contact.isEmergency,
  };
}

/** Erro `400` do contato que não segue a regra do cadastro (RFPAC001.E03). */
function invalidSupportContact(message: string): BadRequestException {
  return new BadRequestException({ status: 'VALIDATION_ERROR', message });
}

function patientNotFound(): NotFoundException {
  return new NotFoundException({
    status: 'PATIENT_NOT_FOUND',
    message: 'Paciente não encontrado.',
  });
}

function supportContactNotFound(): NotFoundException {
  return new NotFoundException({
    status: 'SUPPORT_CONTACT_NOT_FOUND',
    message: 'Contato de suporte não encontrado.',
  });
}

function medicationNotFound(): NotFoundException {
  return new NotFoundException({
    status: 'MEDICATION_NOT_FOUND',
    message: 'Medica��o n�o encontrada.',
  });
}

function invalidMedication(message: string): BadRequestException {
  return new BadRequestException({
    status: 'VALIDATION_ERROR',
    message,
  });
}

function toMedicationResponse(medication: Medication): MedicationResponseDto {
  return {
    id: medication.id,
    patientId: medication.patientId,
    drugName: medication.drugName,
    dose: medication.dose,
    frequency: medication.frequency,
    prescriber: medication.prescriber,
    reason: medication.reason,
    startDate: medication.startDate,
    endDate: medication.endDate,
  };
}

function toMedicationValues(request: MedicationRequestDto): MedicationValues {
  const drugName = request.drugName.trim();
  const dose = request.dose.trim();
  const frequency = request.frequency.trim();

  if (!drugName || !dose || !frequency) {
    throw invalidMedication('Medicamento, dose e frequ�ncia s�o obrigat�rios.');
  }

  if (request.endDate && request.endDate < request.startDate) {
    throw invalidMedication(
      'A data de fim n�o pode ser anterior � data de in�cio.',
    );
  }

  return {
    drugName,
    dose,
    frequency,
    prescriber: textOrNull(request.prescriber),
    reason: textOrNull(request.reason),
    startDate: request.startDate,
    endDate: request.endDate ?? null,
  };
}

/** Texto sem espaços externos; vazio vira `null`. */
function textOrNull(value: string | null | undefined): string | null {
  const text = value?.trim();

  return text ? text : null;
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toAuthorizedPatient(row: PatientRow): AuthorizedPatientResponseDto {
  return {
    id: row.patient_id,
    name: row.account_name,
    socialName: row.social_name,
    email: row.email,
    cns: row.cns,
    guardianName: row.guardian_name,
    registeredAt: toIsoDate(row.registered_at),
    ptsStatus: row.pts_status,
    activePtsId: row.active_pts_id,
    readOnly: row.read_only === true,
  };
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly patientsRepository: PatientsRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Busca pacientes relacionados a PTS ativos aos quais a conta tem acesso.
   *
   * O administrador recebe todos os pacientes cadastrados (RN022).
   *
   * @param account contexto da conta autenticada
   * @param request parâmetros já validados pelo ValidationPipe global
   * @returns pacientes autorizados e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAuthorized(
    account: AccountContext,
    request: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    const scope = patientScope(account);
    let page: PatientsPage;

    try {
      page = await this.patientsRepository.findPatientsPaginated(
        scope,
        request,
      );
    } catch (error) {
      this.logger.error('Authorized patients query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      });
    }

    return {
      data: page.rows.map(toAuthorizedPatient),
      pagination: toPagination(request, page.total),
    };
  }

  async findOne(
    account: AccountContext,
    patientId: string,
  ): Promise<PatientDetailResponseDto> {
    const scope = patientScope(account);
    let row: PatientDetailRow | null;
    let exists: boolean;

    try {
      exists = await this.patientsRepository.patientExists(patientId);
      row = exists
        ? await this.patientsRepository.findPatient(scope, patientId)
        : null;
    } catch (error) {
      this.logger.error('Patient detail query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar o paciente.',
      });
    }

    if (!exists) {
      throw patientNotFound();
    }

    if (!row) {
      throw forbiddenPatient();
    }

    let contacts: SupportContact[];
    let currentPts: CurrentPtsRow | null;
    let hasTcle: boolean;

    try {
      contacts = await this.patientsRepository.findSupportContacts(patientId);
      currentPts = await this.patientsRepository.findCurrentPts(patientId);
      hasTcle = await this.patientsRepository.hasTcle(patientId);
    } catch (error) {
      this.logger.error('Patient support contacts query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar o paciente.',
      });
    }

    return {
      ...toAuthorizedPatient(row),
      phone: row.phone,
      cpf: row.cpf,
      birthDate: row.birth_date,
      sex: row.sex,
      gender: row.gender,
      filiation1: row.filiation_1,
      filiation2: row.filiation_2,
      address: {
        zipCode: row.address_zip_code,
        street: row.address_street,
        number: row.address_number,
        complement: row.address_complement,
        district: row.address_district,
        city: row.address_city,
        state: row.address_state,
      },
      guardianPhone: row.guardian_phone,
      educationLevel: row.education_level,
      schoolName: row.school_name,
      referenceUnit: row.reference_unit,
      clinicalHistory: row.clinical_history,
      surgicalHistory: row.surgical_history,
      familyHistory: row.family_history,
      habits: row.habits,
      developmentalMilestones: row.developmental_milestones,
      allergies: row.allergies,
      noKnownAllergies: row.no_known_allergies,
      supportContacts: contacts.map(toSupportContactResponse),
      diagnosis: currentPts && toDiagnosis(currentPts),
      reassessment: currentPts && toReassessment(currentPts),
      hasTcle,
    };
  }

  /**
   * Atualiza historico clinico e alergias do paciente (RFPAC007).
   */
  async updateClinicalData(
    account: AccountContext,
    patientId: string,
    request: UpdateClinicalDataRequestDto,
  ): Promise<ClinicalDataResponseDto> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'write');

      const current = await this.patientsRepository.findPatient(
        { kind: 'all' },
        patientId,
      );

      if (!current) {
        throw patientNotFound();
      }

      const noKnownAllergies =
        request.noKnownAllergies ?? current.no_known_allergies;

      const requestedAllergies =
        request.allergies === undefined
          ? undefined
          : textOrNull(request.allergies);

      if (
        noKnownAllergies &&
        requestedAllergies !== undefined &&
        requestedAllergies !== null
      ) {
        throw new BadRequestException({
          status: 'VALIDATION_ERROR',
          message:
            'N�o informe alergias quando "Nenhuma alergia conhecida" estiver marcada.',
        });
      }

      const allergies = noKnownAllergies
        ? null
        : requestedAllergies === undefined
          ? current.allergies
          : requestedAllergies;

      const values: ClinicalDataValues = {
        clinicalHistory:
          request.clinicalHistory === undefined
            ? current.clinical_history
            : textOrNull(request.clinicalHistory),

        surgicalHistory:
          request.surgicalHistory === undefined
            ? current.surgical_history
            : textOrNull(request.surgicalHistory),

        familyHistory:
          request.familyHistory === undefined
            ? current.family_history
            : textOrNull(request.familyHistory),

        habits:
          request.habits === undefined
            ? current.habits
            : textOrNull(request.habits),

        developmentalMilestones:
          request.developmentalMilestones === undefined
            ? current.developmental_milestones
            : textOrNull(request.developmentalMilestones),

        allergies,
        noKnownAllergies,
      };

      const updated = await this.patientsRepository.updateClinicalData(
        patientId,
        values,
        account.accountId,
      );

      if (!updated) {
        throw patientNotFound();
      }

      return {
        patientId: updated.accountId,
        clinicalHistory: updated.clinicalHistory,
        surgicalHistory: updated.surgicalHistory,
        familyHistory: updated.familyHistory,
        habits: updated.habits,
        developmentalMilestones: updated.developmentalMilestones,
        allergies: updated.allergies,
        noKnownAllergies: updated.noKnownAllergies,
      };
    } catch (error) {
      throw this.patientDataError(
        error,
        'atualizar os dados clinicos do paciente',
      );
    }
  }

  /**
   * Lista as medicacoes do paciente.
   */
  async findMedications(
    account: AccountContext,
    patientId: string,
  ): Promise<GetMedicationsResponseDto> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'read');

      const medications =
        await this.patientsRepository.findMedications(patientId);

      return {
        data: medications.map(toMedicationResponse),
      };
    } catch (error) {
      throw this.patientDataError(error, 'consultar as medicacoes');
    }
  }

  /**
   * Cadastra uma medicacao de uso continuo.
   */
  async createMedication(
    account: AccountContext,
    patientId: string,
    request: MedicationRequestDto,
  ): Promise<MedicationResponseDto> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'write');

      const medication = await this.patientsRepository.insertMedication(
        patientId,
        toMedicationValues(request),
        account.accountId,
      );

      return toMedicationResponse(medication);
    } catch (error) {
      throw this.patientDataError(error, 'cadastrar a medicacao');
    }
  }

  /**
   * Atualiza uma medicacao existente.
   */
  async updateMedication(
    account: AccountContext,
    patientId: string,
    medicationId: string,
    request: MedicationRequestDto,
  ): Promise<MedicationResponseDto> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'write');

      const current = await this.patientsRepository.findMedication(
        patientId,
        medicationId,
      );

      if (!current) {
        throw medicationNotFound();
      }

      const updated = await this.patientsRepository.updateMedication(
        patientId,
        medicationId,
        toMedicationValues(request),
      );

      if (!updated) {
        throw medicationNotFound();
      }

      return toMedicationResponse(updated);
    } catch (error) {
      throw this.patientDataError(error, 'atualizar a medicacao');
    }
  }

  /**
   * Suspende uma medicacao preenchendo end_date.
   */
  async stopMedication(
    account: AccountContext,
    patientId: string,
    medicationId: string,
  ): Promise<MedicationResponseDto> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'write');

      const current = await this.patientsRepository.findMedication(
        patientId,
        medicationId,
      );

      if (!current) {
        throw medicationNotFound();
      }

      const today = new Date().toISOString().slice(0, 10);

      if (today < current.startDate) {
        throw invalidMedication(
          'A data de fim nao pode ser anterior a data de inicio.',
        );
      }

      const stopped = await this.patientsRepository.stopMedication(
        patientId,
        medicationId,
        account.accountId,
        today,
      );

      if (!stopped) {
        throw medicationNotFound();
      }

      return toMedicationResponse(stopped);
    } catch (error) {
      throw this.patientDataError(error, 'suspender a medicacao');
    }
  }
  /**
   * Lista os contatos de suporte do paciente (RFPAC003). Quem vê: o admin, o
   * profissional com vínculo (RN016, inclusive de PTS encerrado) e o próprio
   * paciente (RN028).
   *
   * @throws NotFoundException `PATIENT_NOT_FOUND`
   * @throws ForbiddenException quando a conta não tem acesso ao paciente
   */
  async findSupportContacts(
    account: AccountContext,
    patientId: string,
  ): Promise<GetSupportContactsResponseDto> {
    let contacts: SupportContact[];

    try {
      await this.assertSupportContactAccess(account, patientId, 'read');
      contacts = await this.patientsRepository.findSupportContacts(patientId);
    } catch (error) {
      throw this.supportContactError(error, 'consultar os contatos de suporte');
    }

    return { data: contacts.map(toSupportContactResponse) };
  }

  /**
   * Cria um contato de suporte (RFPAC003). Só o admin e o membro de PTS ativo
   * do paciente (RN024). Contato de suporte não concede acesso (RN017).
   *
   * @throws BadRequestException `VALIDATION_ERROR` quando faltam e-mail e
   *   telefone, ou o contato de emergência não tem telefone
   */
  async createSupportContact(
    account: AccountContext,
    patientId: string,
    request: SupportContactDto,
  ): Promise<SupportContactResponseDto> {
    const values: SupportContactValues = {
      name: request.name.trim(),
      description: textOrNull(request.description),
      email: textOrNull(request.email),
      phone: textOrNull(request.phone),
      isEmergency: request.isEmergency ?? false,
    };

    try {
      await this.assertSupportContactAccess(account, patientId, 'write');
      this.assertSupportContactChannels(values);

      return toSupportContactResponse(
        await this.patientsRepository.insertSupportContact(patientId, values),
      );
    } catch (error) {
      throw this.supportContactError(error, 'cadastrar o contato de suporte');
    }
  }

  /**
   * Atualiza um contato de suporte (RFPAC003). Os campos ausentes ficam como
   * estão e `null` limpa o campo opcional; a regra do contato inteiro vale
   * para o resultado.
   *
   * @throws NotFoundException `SUPPORT_CONTACT_NOT_FOUND` quando o contato não
   *   existe ou é de outro paciente
   */
  async updateSupportContact(
    account: AccountContext,
    patientId: string,
    contactId: string,
    request: UpdateSupportContactRequestDto,
  ): Promise<SupportContactResponseDto> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'write');

      const current = await this.patientsRepository.findSupportContact(
        patientId,
        contactId,
      );

      if (!current) {
        throw supportContactNotFound();
      }

      const values: SupportContactValues = {
        name: request.name?.trim() ?? current.name,
        description:
          request.description === undefined
            ? current.description
            : textOrNull(request.description),
        email:
          request.email === undefined
            ? current.email
            : textOrNull(request.email),
        phone:
          request.phone === undefined
            ? current.phone
            : textOrNull(request.phone),
        isEmergency: request.isEmergency ?? current.isEmergency,
      };

      this.assertSupportContactChannels(values);

      const updated = await this.patientsRepository.updateSupportContact(
        patientId,
        contactId,
        values,
      );

      if (!updated) {
        throw supportContactNotFound();
      }

      return toSupportContactResponse(updated);
    } catch (error) {
      throw this.supportContactError(error, 'atualizar o contato de suporte');
    }
  }

  /**
   * Remove um contato de suporte (RFPAC003). Só o admin e o membro de PTS
   * ativo do paciente (RN024).
   *
   * @throws NotFoundException `SUPPORT_CONTACT_NOT_FOUND`
   */
  async deleteSupportContact(
    account: AccountContext,
    patientId: string,
    contactId: string,
  ): Promise<void> {
    try {
      await this.assertSupportContactAccess(account, patientId, 'write');

      if (
        !(await this.patientsRepository.deleteSupportContact(
          patientId,
          contactId,
        ))
      ) {
        throw supportContactNotFound();
      }
    } catch (error) {
      throw this.supportContactError(error, 'remover o contato de suporte');
    }
  }

  /**
   * Confere o acesso aos contatos: `read` para o admin, o profissional com
   * vínculo (RN016) e o próprio paciente; `write` só para o admin e o membro
   * de PTS ativo (RN024), com o profissional de PTS encerrado só lendo.
   */
  private async assertSupportContactAccess(
    account: AccountContext,
    patientId: string,
    mode: 'read' | 'write',
  ): Promise<void> {
    if (!(await this.patientsRepository.patientExists(patientId))) {
      throw patientNotFound();
    }

    if (isAdmin(account)) {
      return;
    }

    if (mode === 'read' && account.patientProfileId === patientId) {
      return;
    }

    if (account.professionalProfileIds.length === 0) {
      throw forbiddenPatient();
    }

    const row = await this.patientsRepository.findPatient(
      { kind: 'professional', accountId: account.accountId },
      patientId,
    );

    if (!row || (mode === 'write' && row.read_only)) {
      throw forbiddenPatient();
    }
  }

  /** Aplica a regra do contato inteiro (e-mail ou telefone, emergência). */
  private assertSupportContactChannels(contact: SupportContactChannels): void {
    const message = supportContactChannelError(contact);

    if (message) {
      throw invalidSupportContact(message);
    }
  }

  /** Deixa passar os erros da API e troca os demais por um erro seguro. */

  private patientDataError(error: unknown, action: string): Error {
    if (error instanceof HttpException) {
      return error;
    }

    this.logger.error(`Patient clinical data failed: ${action}`, error);

    return new InternalServerErrorException({
      status: 'ERROR',
      message: `Nao foi possivel ${action}.`,
    });
  }
  private supportContactError(error: unknown, action: string): Error {
    if (error instanceof HttpException) {
      return error;
    }

    this.logger.error(`Support contact failed: ${action}`, error);

    return new InternalServerErrorException({
      status: 'ERROR',
      message: `Não foi possível ${action}.`,
    });
  }

  /**
   * Busca os pacientes elegíveis para uma nova proposta de PTS (RFPTS001,
   * RN011), para o profissional ou o administrador.
   *
   * @param account contexto da conta autenticada
   * @param request busca e paginação já validadas
   * @returns pacientes elegíveis (id, nome exibido e e-mail) e paginação
   */
  async findEligibleForProposal(
    account: AccountContext,
    request: GetEligiblePatientsRequestDto,
  ): Promise<GetEligiblePatientsResponseDto> {
    if (!isAdmin(account) && account.professionalProfileIds.length === 0) {
      throw new ForbiddenException({
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao profissional.',
      });
    }

    let page: EligiblePatientsPage;

    try {
      page = await this.patientsRepository.findEligibleForProposalPaginated({
        page: request.page,
        limit: request.limit,
        q: request.q,
      });
    } catch (error) {
      this.logger.error('Eligible patients query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes elegíveis.',
      });
    }

    const { rows, total } = page;

    return {
      data: rows.map((row) => ({
        id: row.patient_id,
        name: row.display_name,
        email: row.email,
      })),
      pagination: toPagination(request, total),
    };
  }

  /**
   * Cria o perfil de paciente de uma conta existente (RFPAC001).
   *
   * Uma conta tem no máximo um perfil de paciente (RN002); admin, paciente e
   * profissional usam contas separadas (RFPAC001.E04); contato de suporte não
   * concede tutela (RN017).
   *
   * @param request corpo já validado pelo ValidationPipe global
   * @returns perfil criado
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` quando a conta não existe
   * @throws ConflictException `ADMIN_ACCOUNT_NOT_ALLOWED` quando a conta é de
   *   administrador
   * @throws ConflictException `ACCOUNT_HAS_PROFESSIONAL_PROFILE` quando a
   *   conta já tem perfil profissional
   * @throws ConflictException `PATIENT_PROFILE_ALREADY_EXISTS` quando a conta
   *   já tem perfil de paciente, inclusive em pedidos simultâneos
   * @throws InternalServerErrorException quando a gravação falha por outro
   *   motivo, sem expor o erro original
   */
  async create(request: CreatePatientRequestDto): Promise<PatientResponseDto> {
    const account = await this.accountRepository.findOne({
      where: { id: request.accountId },
      relations: { patientProfile: true, professionalProfiles: true },
    });

    if (!account) {
      throw new NotFoundException({
        status: 'ACCOUNT_NOT_FOUND',
        message: 'Conta não encontrada.',
      });
    }

    if (account.role === AccountRole.Admin) {
      throw new ConflictException({
        status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
        message: 'Conta de administrador não pode ter perfil de paciente.',
      });
    }

    if (account.professionalProfiles?.length) {
      throw new ConflictException({
        status: 'ACCOUNT_HAS_PROFESSIONAL_PROFILE',
        message: 'A conta já possui um perfil profissional.',
      });
    }

    if (account.patientProfile) {
      throw patientProfileAlreadyExists();
    }

    const patient: PatientResponseDto = {
      accountId: account.id,
      supportContacts: (request.supportContacts ?? []).map(toSupportContact),
    };

    try {
      await this.patientsRepository.insert(patient);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw patientProfileAlreadyExists();
      }

      this.logger.error('Patient profile insert failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível cadastrar o perfil de paciente.',
      });
    }

    return patient;
  }
}
