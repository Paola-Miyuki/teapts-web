// Liga o plugin do @nestjs/swagger no ts-jest, com as mesmas opções do
// nest-cli.json, para os testes verem os mesmos esquemas que o `nest build`.
//
// - O plugin precisa do `program` do TypeScript, por isso o ts-jest roda com
//   `isolatedModules: false` (sem isso ele só transpila arquivo a arquivo).
// - O build sai em CommonJS, mas o Jest roda em ESM: `esmCompatible` faz o
//   plugin importar o @nestjs/swagger com `import`, e não com `require`.
import { before } from '@nestjs/swagger/plugin';

export const name = 'nestjs-swagger-transformer';
export const version = 1;

export function factory(compiler, options) {
  return before({ ...options, esmCompatible: true }, compiler.program);
}
