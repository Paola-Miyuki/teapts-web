// Única porta para o storage de arquivos. Hoje só existe o driver
// PostgresStorage (decisoes-aprovadas.md §20); um driver S3 pode trocá-lo sem
// mudar quem usa esta classe.

export type SignedUrl = {
  url: string;
  expiresAt: Date;
};

export type PutObjectInput = {
  fileKey: string;
  mimeType: string;
  content: Buffer;
};

/** O objeto já existe: o envio não sobrescreve. */
export class StorageObjectAlreadyExistsError extends Error {
  constructor(readonly fileKey: string) {
    super(`Storage object already exists: ${fileKey}`);
    this.name = 'StorageObjectAlreadyExistsError';
  }
}

export abstract class StorageService {
  /** URL assinada para enviar o objeto, limitada a ele e vencendo em breve. */
  abstract createUploadUrl(fileKey: string, now?: Date): SignedUrl;

  /**
   * Grava o objeto, ainda não ativo.
   *
   * @throws StorageObjectAlreadyExistsError quando a chave já existe
   */
  abstract putObject(input: PutObjectInput): Promise<void>;
}
