// Este arquivo é o ponto de entrada do processo HTTP.
// Ele chama createApp para montar middleware, filtros e módulos.
// O bootstrap só abre a porta depois que toda a aplicação foi criada.
// A ordem garante que o SuperTokens esteja pronto antes de receber requisições.

import { createApp } from './create-app';

/**
 * Cria a aplicação e inicia o servidor HTTP na porta configurada.
 *
 * @returns promise concluída quando o servidor começa a escutar
 * @throws erro de inicialização ou de abertura da porta
 */
async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
