import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Retorna a mensagem básica da aplicação.
   *
   * @returns mensagem usada pela rota de health check simples
   */
  getHello(): string {
    return 'Hello World!';
  }
}
