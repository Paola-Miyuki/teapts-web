import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PtsService } from '../services/pts.service';

/** Corpo aceito pelo POST /pts, com os nomes alternativos dos campos. */
type CreatePtsBody = {
  patientId: string;
  socialSituation?: string;
  social_situation?: string;
  responsibleProfessionalId?: string;
  professionalId?: string;
  responsibleId?: string;
  teamProfessionalIds?: string[];
};

// Tipos só para tirar o `any`, sem mudar o comportamento. O projeto não
// preenche `req.user` (o contexto fica em `req.accountContext`); ver R2 em
// `.dev/futuras-alteracoes-modulo-pacientes.md`.
type RequestWithUser = Request & {
  user: { professionalProfileId: string };
};

@Controller('pts')
export class PtsController {
  constructor(private readonly ptsService: PtsService) {}

  @Post()
  async createDraft(@Body() body: CreatePtsBody, @Req() req: RequestWithUser) {
    const patientId = body.patientId;
    const socialSituation = body.socialSituation ?? body.social_situation ?? '';
    const responsibleProfessionalId =
      body.responsibleProfessionalId ??
      body.professionalId ??
      body.responsibleId ??
      req.user?.professionalProfileId;

    return await this.ptsService.createDraft({
      patientId,
      responsibleProfessionalId,
      socialSituation,
      teamProfessionalIds: body.teamProfessionalIds ?? [],
    });
  }

  @Get('proposals')
  async findProposals(
    @Query('patientId') patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return await this.ptsService.findByPatientId(patientId, pageNum, limitNum);
  }
}
