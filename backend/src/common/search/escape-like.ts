// Este arquivo concentra o escape de termos de busca usados em ILIKE.

/** Escapa `\`, `%` e `_` para a busca tratá-los como texto no `ILIKE`. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}
