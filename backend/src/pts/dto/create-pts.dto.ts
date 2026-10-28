import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
} from 'class-validator';

import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export class CreatePtsRequestDto {
  @IsUUID()
  @IsNotEmpty()
  professionalId: string;

  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  socialSituation: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamProfessionalIds?: string[];
}

export interface PtsSpecialismDto {
  id: string;
  name: string;
}

export interface PtsProfessionalDto {
  id: string;
  name: string;
  specialism: PtsSpecialismDto;
}

export class CreatePtsResponseDto {
  id: string;
  status: PtsStateEnum;
  socialSituation: string;
  createdAt: string;

  patient: {
    id: string;
    name: string;
  };

  responsible: PtsProfessionalDto;
  team: PtsProfessionalDto[];
}
