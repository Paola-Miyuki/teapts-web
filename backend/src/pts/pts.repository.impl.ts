import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { CreatePtsResponseDto } from './dto/create-pts.dto';
import { CreateDraftInput, ProfessionalRecord, PtsRepository } from './pts.repository';
import { PtsEntity, PtsStateEnum } from './entities/pts.entity';
import { Professional } from '../database/entities/professional.entity';
import { Patient } from '../database/entities/patient.entity';

@Injectable()
export class PtsRepositoryImpl extends PtsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {
    super();
  }

  async findProfessionalById(id: number): Promise<ProfessionalRecord | null> {
    const professional = await this.professionalRepository.findOne({
      where: { id: id as any },
      relations: ['account'],
    });

    if (!professional) return null;

    return {
      id: professional.id as unknown as number,
      accountId: professional.account?.id,
    };
  }

  async patientExists(id: number): Promise<boolean> {
    const count = await this.patientRepository.count({
      where: { accountId: id as any },
    });
    return count > 0;
  }

  async hasApprovedActivePts(patientId: number): Promise<boolean> {
    const count = await this.ptsRepository.count({
      where: {
        patientId: patientId as any,
        status: In([PtsStateEnum.PLANNING, PtsStateEnum.RUNNING]),
      },
    });
    return count > 0;
  }

  async findExistingProfessionalIds(ids: number[]): Promise<number[]> {
    if (!ids || ids.length === 0) return [];
    
    const found = await this.professionalRepository.find({
      where: { id: In(ids as any[]) },
    });

    return found.map((p) => p.id as unknown as number);
  }

  async createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Criar e salvar o PTS principal em DRAFT
      const pts = queryRunner.manager.create(PtsEntity, {
        socialSituation: input.socialSituation,
        status: PtsStateEnum.DRAFT,
        patientId: input.patientId as any,
        responsibleProfessionalId: input.responsibleProfessionalId as any,
      });

      const savedPts = await queryRunner.manager.save(PtsEntity, pts);

      // 2. Inserir a equipa inicial na tabela de junção, se houver IDs
      if (input.teamProfessionalIds && input.teamProfessionalIds.length > 0) {
        const uniqueTeamIds = Array.from(new Set(input.teamProfessionalIds)).filter(
          (id) => id !== input.responsibleProfessionalId,
        );

        for (const profId of uniqueTeamIds) {
          await queryRunner.query(
            `INSERT INTO professional_participating_on_therapeutic_journey (professional_id, therapeutic_journey_id) VALUES ($1, $2)`,
            [profId, savedPts.id],
          );
        }
      }

      await queryRunner.commitTransaction();

      // 3. Buscar dados completos para montar o DTO de resposta
      const fullPts = await this.ptsRepository.findOne({
        where: { id: savedPts.id },
        relations: ['patient', 'patient.account', 'responsible', 'responsible.account', 'responsible.specialism', 'team', 'team.account', 'team.specialism'],
      });

      return {
        id: fullPts.id,
        status: fullPts.status.toUpperCase() as any,
        socialSituation: fullPts.socialSituation,
        createdAt: fullPts.createdAt.toISOString(),
        patient: {
          id: fullPts.patient.accountId,
          name: fullPts.patient.account.name,
        },
        responsible: {
          id: fullPts.responsible.id,
          name: fullPts.responsible.account.name,
          specialism: {
            id: fullPts.responsible.specialism?.id,
            name: fullPts.responsible.specialism?.name,
          },
        },
        team: fullPts.team ? fullPts.team.map((t) => ({
          id: t.id,
          name: t.account.name,
          specialism: {
            id: t.specialism?.id,
            name: t.specialism?.name,
          },
        })) : [],
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}