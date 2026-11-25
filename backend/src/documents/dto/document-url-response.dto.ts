// Contrato público da URL de leitura do documento (RFDOC003). É classe, e não
// interface, para aparecer no OpenAPI.

/** URL temporária para abrir ou baixar o arquivo. */
export class DocumentUrlResponseDto {
  /** URL do backend com o token de leitura, limitada ao objeto. */
  url: string;
  /** Vencimento da URL, em ISO 8601. */
  expiresAt: string;
}
