import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PtsEntity } from './entities/pts.entity';
import { PtsStateEnum } from '../database/enums/pts-state.enum';
import { Professional } from '../database/entities/professional.entity';
import { Patient } from '../database/entities/patient.entity';

@Injectable()
export class PtsService {
  constructor(
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async createPts(dto: any, currentAccountId: string) {
const professional = await this.professionalRepository.findOne({
  where: { id: dto.responsibleProfessionalId },
  relations: {
    account: true,
  },
});
    if (!professional || professional.account?.id !== currentAccountId) {
      throw new ForbiddenException('Profissional não autorizado ou não encontrado.');
    }

    // Validação do paciente
    const patient = await this.patientRepository.findOne({
      where: { accountId: dto.patientId },
      relations: {
        account: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    const pts = this.ptsRepository.create({
      status: PtsStateEnum.DRAFT,
      socialSituation: dto.socialSituation,
      patientId: dto.patientId,
      responsibleProfessionalId: dto.responsibleProfessionalId,
    });

    const savedPts = await this.ptsRepository.save(pts);
    return savedPts;
  }

  async findByPatient(patientId: string) {
    return this.ptsRepository.find({
      where: { patientId },
      relations: {
        patient: { account: true },
        responsible: { account: true },
        team: { account: true },
    },
    });
  }
}