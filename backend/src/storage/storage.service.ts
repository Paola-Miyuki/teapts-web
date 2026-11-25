// Única porta para o storage de arquivos. Hoje só existe o driver
// PostgresStorage (decisoes-aprovadas.md §20); um driver S3 pode trocá-lo sem
// mudar quem usa esta classe.

import type { EntityManager } from 'typeorm';

export type SignedUrl = {
  url: string;
  expiresAt: Date;
};

export type PutObjectInput = {
  fileKey: string;
  mimeType: string;
  content: Buffer;
};

/** Dados do objeto gravado, lidos do storage e não do cliente. */
export type StoredObjectInfo = {
  mimeType: string;
  sizeBytes: number;
};

/** Objeto lido do storage, com o conteúdo. */
export type StoredObjectContent = StoredObjectInfo & {
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
  /**
   * URL assinada para enviar o objeto, limitada a ele e ao tipo do arquivo, e
   * vencendo em breve.
   */
  abstract createUploadUrl(
    fileKey: string,
    mimeType: string,
    now?: Date,
  ): SignedUrl;

  /**
   * URL assinada para ler o objeto, limitada a ele e vencendo em breve.
   */
  abstract createReadUrl(fileKey: string, now?: Date): SignedUrl;

  /**
   * Grava o objeto, ainda não ativo.
   *
   * @throws StorageObjectAlreadyExistsError quando a chave já existe
   */
  abstract putObject(input: PutObjectInput): Promise<void>;

  /**
   * Confere se o objeto existe e devolve o tipo e o tamanho gravados.
   *
   * @returns os dados do objeto, ou `null` quando ele não existe
   */
  abstract headObject(fileKey: string): Promise<StoredObjectInfo | null>;

  /**
   * Lê o objeto com o conteúdo.
   *
   * @returns o objeto, ou `null` quando ele não existe
   */
  abstract getObject(fileKey: string): Promise<StoredObjectContent | null>;

  /**
   * Marca o objeto como ativo (documento confirmado). Para ficar na mesma
   * transação do documento, passe o `manager` dela; drivers que não usam o
   * banco ignoram o parâmetro.
   */
  abstract activateObject(
    fileKey: string,
    manager?: EntityManager,
  ): Promise<void>;
}
