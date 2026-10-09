import { IsInt, IsString, IsNotEmpty, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreatePtsRequestDto {
  @IsUUID()
  @IsNotEmpty()
  professionalId: string;

  @IsInt()
  @IsNotEmpty()
  patientId: number;

  @IsString()
  @IsNotEmpty()
  socialSituation: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamProfessionalIds?: string[];
}

export interface CreatePtsResponseDto {
  id: number;
  patientId: number;
  responsibleProfessionalId: string;
  socialSituation: string;
  status: 'DRAFT';
  createdAt: string;
  teamProfessionalIds: string[];
}