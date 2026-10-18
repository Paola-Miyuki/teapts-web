import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Specialism } from '../enums/specialism.enum';
import type { GetProfessionalsResponseDto } from '../dto/get-professionals-response.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from '../services/professionals.service';

// O teste valida o contrato HTTP da rota, com o ValidationPipe global.
describe('GET /professionals', () => {
  let app: INestApplication;
  let guardCanActivate: jest.Mock;
  let professionalsService: {
    findAll: jest.Mock<
      (
        input: Parameters<ProfessionalsService['findAll']>[0],
      ) => Promise<GetProfessionalsResponseDto>
    >;
  };

  beforeEach(async () => {
    guardCanActivate = jest.fn(() => true);
    professionalsService = {
      findAll: jest.fn(async () => ({
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Maria Silva',
            email: 'maria@example.com',
            specialism: {
              id: Specialism.Psychologist,
              name: 'Psicologia',
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        {
          provide: ProfessionalsService,
          useValue: professionalsService,
        },
        AuthGuard,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: guardCanActivate })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the paginated response through the HTTP route', async () => {
    const response = await request(app.getHttpServer())
      .get('/professionals')
      .query({
        page: 1,
        limit: 10,
        name: 'Maria',
        specialism: Specialism.Psychologist,
        ids: '550e8400-e29b-41d4-a716-446655440000',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Maria Silva',
          email: 'maria@example.com',
          specialism: {
            id: Specialism.Psychologist,
            name: 'Psicologia',
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(professionalsService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      name: 'Maria',
      specialism: 'psychologist',
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  it('normalizes the query before calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/professionals')
      .query({
        page: '2',
        limit: '20',
        name: '  Maria ',
        specialism: 'psychologist',
        ids: '550e8400-e29b-41d4-a716-446655440000',
      });

    expect(response.status).toBe(200);
    expect(professionalsService.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      name: 'Maria',
      specialism: 'psychologist',
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  it('returns a validation error without calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/professionals')
      .query({ limit: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: limit',
    });
    expect(professionalsService.findAll).not.toHaveBeenCalled();
  });

  it('does not call the service when authentication blocks the request', async () => {
    guardCanActivate.mockReturnValue(false);

    const response = await request(app.getHttpServer()).get('/professionals');

    expect(response.status).toBe(403);
    expect(professionalsService.findAll).not.toHaveBeenCalled();
  });
});
