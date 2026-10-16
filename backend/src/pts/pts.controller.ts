import { Controller, Post, Body, UseGuards, HttpStatus, HttpException } from '@nestjs/common';
import { PtsService } from './pts.service';
import { CreatePtsRequestDto } from './dto/create-pts.dto';
// Assumindo decorator de sessão padrão do projeto
import { CurrentAccount } from '../../auth/decorators/current-account.decorator'; 

@Controller('pts')
export class PtsController {
  constructor(private readonly ptsService: PtsService) {}

  @Post()
  async create(
    @Body() dto: CreatePtsRequestDto,
    @CurrentAccount() accountId: string,
  ) {
    return this.ptsService.create(dto, accountId);
  }
}