// Este arquivo define o contrato publico do detalhe do paciente.

import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../accounts/enums/gender.enum';
import { Sex } from '../../accounts/enums/sex.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { UFS, type Uf } from '../../professionals/enums/uf.enum';
import { EducationLevel } from '../enums/education-level.enum';
import { SupportContactResponseDto } from './support-contact-response.dto';
import { AuthorizedPatientResponseDto } from './get-authorized-patients-response.dto';

/** Endereço do cadastro; os campos são nulos nos pacientes anteriores a eles. */
export class PatientAddressResponseDto {
  /** CEP, 8 dígitos. */
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  @ApiProperty({ enum: UFS, nullable: true, example: 'pr' })
  state: Uf | null;
}

/** Diagnóstico em comum do PTS atual do paciente (RN030). */
export class PatientDiagnosisResponseDto {
  ptsId: string;
  @ApiProperty({ enum: PtsStateEnum })
  ptsStatus: PtsStateEnum;
  /** Data do estudo de caso, `YYYY-MM-DD`. */
  caseStudyDate: string;
  /** Código da CID-10, ex.: `F84.0`. */
  cid: string | null;
  /** Nível de suporte, de 1 a 3. */
  supportLevel: number | null;
  summary: string;
  strengths: string | null;
  priorityNeeds: string[];
  socialSituation: string;
}

/**
 * Janela de reavaliação do PTS ativo (RN031): `open` de 30 dias antes da
 * próxima revisão até a data; `overdue` depois dela.
 */
export class PatientReassessmentResponseDto {
  @ApiProperty({ enum: ['open', 'overdue'] })
  status: 'open' | 'overdue';
  /** Próxima revisão, `YYYY-MM-DD`. */
  nextReviewAt: string;
}

export class PatientDetailResponseDto extends AuthorizedPatientResponseDto {
  phone: string | null;
  cpf: string | null;

  /** Data de nascimento da conta, `YYYY-MM-DD`. */
  birthDate: string | null;

  @ApiProperty({ enum: Sex, nullable: true })
  sex: Sex | null;

  @ApiProperty({ enum: Gender, nullable: true })
  gender: Gender | null;

  /** Filiação 1; aceita "Não declarado". */
  filiation1: string | null;

  filiation2: string | null;

  address: PatientAddressResponseDto;

  guardianPhone: string | null;

  @ApiProperty({ enum: EducationLevel, nullable: true })
  educationLevel: EducationLevel | null;

  /** Instituição de ensino. */
  schoolName: string | null;

  /** Unidade de referência (UBS, CER, CAPS). */
  referenceUnit: string | null;

  clinicalHistory: string | null;

  surgicalHistory: string | null;

  familyHistory: string | null;

  habits: string | null;

  developmentalMilestones: string | null;

  allergies: string | null;

  noKnownAllergies: boolean;

  supportContacts: SupportContactResponseDto[];

  /** Diagnóstico do PTS atual; `null` quando o paciente não tem PTS. */
  @ApiProperty({ type: PatientDiagnosisResponseDto, nullable: true })
  diagnosis: PatientDiagnosisResponseDto | null;

  /** Selo "Reavaliação aberta" ou "Reavaliação vencida"; `null` fora da janela. */
  @ApiProperty({ type: PatientReassessmentResponseDto, nullable: true })
  reassessment: PatientReassessmentResponseDto | null;

  /** `false` mostra o selo "Sem TCLE". */
  hasTcle: boolean;
}
