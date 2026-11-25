// Descrição da CID-10 dos códigos do espectro autista e dos transtornos
// associados que o app mostra com o CID do PTS ("F84.0 – Autismo infantil",
// propriedades-front.md, 3.2). Tabela fixa do app; código fora dela aparece só
// com o código.
const CID_DESCRIPTIONS: Record<string, string> = {
  'F84.0': 'Autismo infantil',
  'F84.1': 'Autismo atípico',
  'F84.2': 'Síndrome de Rett',
  'F84.3': 'Outro transtorno desintegrativo da infância',
  'F84.4':
    'Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados',
  'F84.5': 'Síndrome de Asperger',
  'F84.8': 'Outros transtornos globais do desenvolvimento',
  'F84.9': 'Transtorno global do desenvolvimento não especificado',
  'F90.0': 'Transtorno de déficit de atenção com hiperatividade',
  'F80.1': 'Transtorno expressivo da linguagem',
  'F70.0': 'Retardo mental leve',
};

/** Descrição da CID-10, ou `null` quando o código não está na tabela. */
export function cidDescription(cid: string): string | null {
  return CID_DESCRIPTIONS[cid.trim().toUpperCase()] ?? null;
}
