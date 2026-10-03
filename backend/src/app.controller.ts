import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Retorna a resposta simples usada para verificar se a API está disponível.
   *
   * @returns mensagem de disponibilidade da aplicação
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
