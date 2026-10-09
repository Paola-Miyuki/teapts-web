import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PtsEntity, PtsStatus } from './entities/pts.entity';
import { Professional } from '../database/entities/professional.entity';
import { CreatePtsRequestDto, CreatePtsResponseDto } from './dto/create-pts.dto';

@Injectable()
export class TherapeuticPlansService {
  constructor(
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
  ) {}

  async createPts(
    dto: CreatePtsRequestDto,
    authenticatedUserId: string, 
  ): Promise<CreatePtsResponseDto> {
    const professional = await this.findProfessionalById(dto.professionalId);
    if (!professional) {
      throw new NotFoundException({
        status: 'PROFESSIONAL_NOT_FOUND',
        message: 'Profissional responsável não encontrado.',
      });
    }

    if (professional.userId !== authenticatedUserId) {
      throw new ForbiddenException({
        status: 'FORBIDDEN_PROFESSIONAL',
        message: 'O professionalId informado não pertence à conta autenticada.',
      });
    }

    // verifica se o paciente informado existe
    const patientExists = await this.verifyPatientExists(dto.patientId);
    if (!patientExists) {
      throw new NotFoundException({
        status: 'PATIENT_NOT_FOUND',
        message: 'Paciente informado não foi encontrado.',
      });
    }
    const activePts = await this.ptsRepository.findOne({
      where: {
        patientId: dto.patientId,
        status: PtsStatus.APPROVED,
      },
    });

    if (activePts) {
      throw new ConflictException({
        status: 'PTS_ACTIVE_EXISTS',
        message: 'O paciente já possui um PTS aprovado e ativo.',
      });
    }
    const teamIds = dto.teamProfessionalIds || [];
    if (teamIds.length > 0) {
      const validTeam = await this.validateProfessionalsExist(teamIds);
      if (!validTeam) {
        throw new BadRequestException({
          status: 'INVALID_TEAM_PROFESSIONALS',
          message: 'Um ou mais profissionais da equipe inicial não existem.',
        });
      }
    }

    // criar o PTS com status DRAFT
    const newPts = this.ptsRepository.create({
      patientId: dto.patientId,
      responsibleProfessionalId: dto.professionalId,
      socialSituation: dto.socialSituation,
      status: PtsStatus.DRAFT,
      teamProfessionalIds: teamIds,
    });

    const savedPts = await this.ptsRepository.save(newPts);

    return {
      id: savedPts.id,
      patientId: savedPts.patientId,
      responsibleProfessionalId: savedPts.responsibleProfessionalId,
      socialSituation: savedPts.socialSituation,
      status: 'DRAFT',
      createdAt: savedPts.createdAt.toISOString(),
      teamProfessionalIds: savedPts.teamProfessionalIds,
    };
  }

  private async validateProfessionalsExist(ids: string[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;

    const uniqueIds = [...new Set(ids)];

    const count = await this.professionalRepository.count({
      where: {
        id: In(uniqueIds),
      },
    });

    return count === uniqueIds.length;
  }

  private async findProfessionalById(id: string): Promise<{ id: string; userId: string } | null> {
    const prof = await this.professionalRepository.findOne({ where: { id } });
    if (!prof) return null;

    return { 
      id: prof.id, 
      userId: prof.accountId // accountId já é UUID (string)
    };
  }

  private async verifyPatientExists(patientId: number): Promise<boolean> {
    // IMPLEMENTAR A VERIFICACAO COM O REPOSITORIO OU SERVICO DE PACIENTES!
    return true;
  }
}