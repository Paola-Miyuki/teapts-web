import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
} from 'class-validator';

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
  status:
    'DRAFT' | 'PLANNING' | 'RUNNING' | 'CONCLUDED' | 'CANCELLED' | 'REJECTED';
  socialSituation: string;
  createdAt: string;
  patient: {
    id: string;
    name: string;
  };
  responsible: PtsProfessionalDto;
  team: PtsProfessionalDto[];
}
