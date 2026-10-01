// Este arquivo encaminha erros que pertencem ao SuperTokens.
// O filtro usa o errorHandler oficial para preservar os status e contratos.
// Erros de sessão inválida normalmente viram respostas 401.
// Erros de negócio não-SuperTokens seguem a cadeia padrão do Express/Nest.

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import supertokens from 'supertokens-node';
import { errorHandler } from 'supertokens-node/framework/express';

/**
 * Converte erros produzidos pelo SuperTokens em respostas HTTP compatíveis
 * com o middleware Express usado pela aplicação NestJS.
 */
@Catch(supertokens.Error)
export class SupertokensExceptionFilter implements ExceptionFilter {
  private readonly handler = errorHandler();

  /**
   * Encaminha a exceção para o formatador oficial do SuperTokens.
   *
   * @param exception erro reconhecido pelo decorator @Catch
   * @param host contexto HTTP do NestJS
   * @throws erros que não pertencem ao contrato do SuperTokens
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    void this.handler(
      exception,
      ctx.getRequest<Request>(),
      ctx.getResponse<Response>(),
      ctx.getNext(),
    );
  }
}
