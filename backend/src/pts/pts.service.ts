import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProjetoTerapeuticoSingular, PtsStateEnum } from './entities/projeto-terapeutico-singular.entity';
import { CreatePtsRequestDto } from './dto/create-pts.dto';
import { Professional } from '../../professional/entities/professional.entity';
import { Patient } from '../../patient/entities/patient.entity';

@Injectable()
export class PtsService {
  constructor(
    @InjectRepository(ProjetoTerapeuticoSingular)
    private readonly ptsRepository: Repository<ProjetoTerapeuticoSingular>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async create(dto: CreatePtsRequestDto, currentAccountId: string) {
    // 1. Validar que o professionalId pertence à conta autenticada
    const professional = await this.professionalRepository.findOne({
      where: { id: dto.professionalId },
      relations: ['account', 'specialism'],
    });

    if (!professional || professional.account.id !== currentAccountId) {
      throw new HttpException(
        { status: 'FORBIDDEN', message: 'O professionalId informado não pertence à conta autenticada.' },
        HttpStatus.FORBIDDEN,
      );
    }

    // 2. Validar que o paciente existe
    const patient = await this.patientRepository.findOne({
      where: { accountId: dto.patientId },
      relations: ['account'],
    });

    if (!patient) {
      throw new HttpException(
        { status: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado.' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 3. Validar que o paciente não tem PTS ativo em PLANNING ou RUNNING (RN011)
    const activePts = await this.ptsRepository.findOne({
      where: {
        patientId: dto.patientId,
        status: In([PtsStateEnum.PLANNING, PtsStateEnum.RUNNING]),
      },
    });

    if (activePts) {
      throw new HttpException(
        { status: 'ACTIVE_PTS_ALREADY_EXISTS', message: 'O paciente já possui um PTS aprovado ativo.' },
        HttpStatus.CONFLICT,
      );
    }

    // 4. Validar e buscar os profissionais da equipe (removendo duplicados e o responsável)
    let teamMembers: Professional[] = [];
    if (dto.teamProfessionalIds && dto.teamProfessionalIds.length > 0) {
      const uniqueTeamIds = Array.from(new Set(dto.teamProfessionalIds)).filter(
        (id) => id !== dto.professionalId,
      );

      teamMembers = await this.professionalRepository.find({
        where: { id: In(uniqueTeamIds) },
        relations: ['specialism'],
      });

      if (teamMembers.length !== uniqueTeamIds.length) {
        throw new HttpException(
          { status: 'PROFESSIONAL_NOT_FOUND', message: 'Um ou mais profissionais da equipe não foram encontrados.' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 5. Persistir o PTS em DRAFT
    const pts = this.ptsRepository.create({
      socialSituation: dto.socialSituation,
      status: PtsStateEnum.DRAFT,
      patientId: dto.patientId,
      responsibleProfessionalId: dto.professionalId,
      team: teamMembers,
    });

    const savedPts = await this.ptsRepository.save(pts);

    // 6. Retornar formatado com status em maiúsculas conforme DTO de resposta
    return {
      id: savedPts.id,
      status: savedPts.status.toUpperCase(),
      socialSituation: savedPts.socialSituation,
      createdAt: savedPts.createdAt.toISOString(),
      patient: {
        id: patient.accountId,
        name: patient.account.name,
      },
      responsible: {
        id: professional.id,
        name: professional.account.name,
        specialism: {
          id: professional.specialism?.id,
          name: professional.specialism?.name,
        },
      },
      team: teamMembers.map((member) => ({
        id: member.id,
        name: member.account.name,
        specialism: {
          id: member.specialism?.id,
          name: member.specialism?.name,
        },
      })),
    };
  }
}