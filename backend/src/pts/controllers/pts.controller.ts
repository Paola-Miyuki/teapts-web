import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { PtsService } from '../services/pts.service';

@Controller('pts')
export class PtsController {
  constructor(private readonly ptsService: PtsService) {}

  @Post()
  async createDraft(
    @Body() body: any,
    @Req() req: any,
  ) {
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

    return await this.ptsService.findByPatientId(
      patientId,
      pageNum,
      limitNum,
    );
  }
}