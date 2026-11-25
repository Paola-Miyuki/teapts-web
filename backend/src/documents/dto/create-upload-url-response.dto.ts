// Contrato público da URL de envio. É classe, e não interface, para aparecer
// no OpenAPI.

/** URL temporária de envio do arquivo e a chave do objeto. */
export class CreateUploadUrlResponseDto {
  /** URL assinada, limitada ao objeto e ao tipo do arquivo. */
  uploadUrl: string;
  /**
   * Chave do objeto no storage, `<patientId>/<uuid>-<nome>`.
   * @example 7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11/a1b2c3d4-laudo.pdf
   */
  fileKey: string;
  /** Vencimento da URL, em ISO 8601. */
  expiresAt: string;
}
