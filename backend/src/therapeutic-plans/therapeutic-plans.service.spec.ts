import { Test, TestingModule } from '@nestjs/testing';
import { PtsService } from './therapeutic-plans.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PtsEntity, PtsStatus } from './entities/pts.entity';
import { ConflictException, ForbiddenException } from '@nestjs/common';

describe('PtsService', () => {
  let service: PtsService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((pts) => Promise.resolve({ id: 100, createdAt: new Date(), ...pts })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PtsService,
        {
          provide: getRepositoryToken(PtsEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PtsService>(PtsService);
  });

  it('deve criar uma proposta de PTS com sucesso com status DRAFT', async () => {
    jest.spyOn(service as any, 'findProfessionalById').mockResolvedValue({ id: 10, userId: 10 });
    jest.spyOn(service as any, 'verifyPatientExists').mockResolvedValue(true);
    jest.spyOn(service as any, 'validateProfessionalsExist').mockResolvedValue(true);
    mockRepository.findOne.mockResolvedValue(null);

    const dto = {
      professionalId: 10,
      patientId: 25,
      socialSituation: 'Paciente em situação de vulnerabilidade social.',
      teamProfessionalIds: [11, 15],
    };

    const result = await service.createPts(dto, 10);

    expect(result).toHaveProperty('id', 100);
    expect(result.status).toBe('DRAFT');
    expect(result.responsibleProfessionalId).toBe(10);
    expect(result.patientId).toBe(25);
  });

  it('deve lançar ConflictException quando já existir um PTS ativo e aprovado', async () => {
    jest.spyOn(service as any, 'findProfessionalById').mockResolvedValue({ id: 10, userId: 10 });
    jest.spyOn(service as any, 'verifyPatientExists').mockResolvedValue(true);
    
    // Simula PTS existente
    mockRepository.findOne.mockResolvedValue({ id: 1, status: PtsStatus.APPROVED });

    const dto = {
      professionalId: 10,
      patientId: 25,
      socialSituation: 'Situação de teste',
    };

    await expect(service.createPts(dto, 10)).rejects.toThrow(ConflictException);
  });

  it('deve rejeitar se o professionalId não pertencer à conta autenticada', async () => {
    jest.spyOn(service as any, 'findProfessionalById').mockResolvedValue({ id: 10, userId: 999 });

    const dto = {
      professionalId: 10,
      patientId: 25,
      socialSituation: 'Situação de teste',
    };

    await expect(service.createPts(dto, 10)).rejects.toThrow(ForbiddenException);
  });
});