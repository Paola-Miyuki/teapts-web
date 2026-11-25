import { ApiError, request } from '@/lib/api';

// Política dos arquivos (RFDOC001): PDF, PNG, JPG, DOC e DOCX, até 5 MB. A API
// confere de novo; aqui só se evita pedir a URL de um arquivo que ela recusaria.
export const MAX_FILE_SIZE_BYTES = 5_242_880;

export const FILE_TYPES = [
  { mimeType: 'application/pdf', extensions: ['pdf'] },
  { mimeType: 'image/png', extensions: ['png'] },
  { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { mimeType: 'application/msword', extensions: ['doc'] },
  {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
  },
] as const;

export const ACCEPTED_EXTENSIONS = FILE_TYPES.flatMap(
  ({ extensions }) => extensions,
)
  .map((extension) => `.${extension}`)
  .join(',');

export const FILE_TYPE_ERROR =
  'Tipo de arquivo não permitido. Envie PDF, PNG, JPG, DOC ou DOCX';
export const FILE_SIZE_ERROR = 'O arquivo deve ter no máximo 5 MB';

/**
 * Tipo do arquivo para a API: o que o navegador informa, ou o da extensão
 * quando ele vem vazio (comum em .doc e .docx). Vazio se não for permitido.
 */
export function mimeTypeOf(file: File): string {
  const byType = FILE_TYPES.find(({ mimeType }) => mimeType === file.type);

  if (byType) {
    return byType.mimeType;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  return (
    FILE_TYPES.find(({ extensions }) =>
      (extensions as readonly string[]).includes(extension),
    )?.mimeType ?? ''
  );
}

/** Mensagem de erro do arquivo, ou texto vazio quando ele é aceito. */
export function validateFile(file: File): string {
  if (!mimeTypeOf(file)) {
    return FILE_TYPE_ERROR;
  }

  if (file.size === 0) {
    return 'O arquivo está vazio';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return FILE_SIZE_ERROR;
  }

  return '';
}

export type UploadUrl = {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
};

// POST /patients/:id/documents/upload-url: URL temporária para enviar o
// arquivo. Nada é gravado até o envio e a confirmação do documento.
export function createUploadUrl(patientId: string, file: File) {
  return request<UploadUrl>(
    `/patients/${encodeURIComponent(patientId)}/documents/upload-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: mimeTypeOf(file),
        sizeBytes: file.size,
      }),
    },
  );
}

// Categorias do documento (RFDOC002), com os rótulos de propriedades-front.md.
export const DOCUMENT_CATEGORIES = [
  { value: 'medical_report', label: 'Laudo médico' },
  { value: 'exam', label: 'Exame' },
  { value: 'prescription', label: 'Receita' },
  { value: 'therapy_report', label: 'Relatório terapêutico' },
  { value: 'school_report', label: 'Relatório escolar' },
  { value: 'pei', label: 'PEI' },
  { value: 'discharge_report', label: 'Relatório de alta' },
  { value: 'tcle', label: 'TCLE' },
  { value: 'image_authorization', label: 'Autorização de uso de imagem' },
  { value: 'other', label: 'Outro' },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]['value'];

// Corpo do POST /patients/:id/documents: no máximo um emissor, e os campos
// opcionais vazios nem são enviados.
export type ConfirmDocumentInput = {
  fileKey: string;
  title: string;
  category: DocumentCategory;
  issueDate?: string;
  issuerAccountId?: string;
  issuerName?: string;
  description?: string;
};

export type ConfirmedDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type UpdatedDocument = {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
};

export type DocumentMetadata = Pick<
  UpdatedDocument,
  'id' | 'title' | 'description'
>;

export function updateDocument(
  documentId: string,
  input: { title: string; description: string | null },
) {
  return request<UpdatedDocument>(
    `/documents/${encodeURIComponent(documentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

// POST /patients/:id/documents: confirma o envio e cria o documento. Repetir a
// `fileKey` devolve o documento já criado.
export function confirmDocument(
  patientId: string,
  input: ConfirmDocumentInput,
) {
  return request<ConfirmedDocument>(
    `/patients/${encodeURIComponent(patientId)}/documents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

// TCLE e autorização de uso de imagem: vão para a aba "Termos e consentimentos".
export const TERM_CATEGORIES = [
  'tcle',
  'image_authorization',
] as const satisfies readonly DocumentCategory[];

export const TERM_CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.filter(({ value }) =>
  (TERM_CATEGORIES as readonly string[]).includes(value),
);

// Demais categorias, na aba "Documentos".
export const NON_TERM_CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.filter(
  ({ value }) => !(TERM_CATEGORIES as readonly string[]).includes(value),
);

export function categoryLabel(category: string) {
  return (
    DOCUMENT_CATEGORIES.find(({ value }) => value === category)?.label ??
    category
  );
}

// Emissor do documento: profissional do sistema ou texto livre, de fora.
export type DocumentIssuer = {
  name: string;
  specialism?: string;
  institution?: string;
  outsideSystem: boolean;
};

export type DocumentListItem = {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  issuer: DocumentIssuer | null;
  // `AAAA-MM-DD`.
  issueDate: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string; isPatient: boolean };
  createdAt: string;
};

export type DocumentList = {
  data: DocumentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DocumentsQuery = {
  page: number;
  limit: number;
  q?: string;
  category?: readonly DocumentCategory[];
};

function toParams({ page, limit, q, category = [] }: DocumentsQuery) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const term = q?.trim();

  if (term) {
    params.set('q', term);
  }

  if (category.length > 0) {
    params.set('category', category.join(','));
  }

  return params;
}

// GET /patients/:id/documents (RFDOC003): admin e profissional vinculado;
// filtros vazios não entram na query string.
export function getDocuments(
  patientId: string,
  query: DocumentsQuery,
  signal?: AbortSignal,
) {
  return request<DocumentList>(
    `/patients/${encodeURIComponent(patientId)}/documents?${toParams(query)}`,
    { signal },
  );
}

// GET /me/documents (RFDOC007): só o que o paciente titular enviou.
export function getMyDocuments(query: DocumentsQuery, signal?: AbortSignal) {
  return request<DocumentList>(`/me/documents?${toParams(query)}`, { signal });
}

export type DocumentUrl = { url: string; expiresAt: string };

// GET /documents/:id/url: URL temporária de leitura; pedida a cada clique,
// porque vence em poucos minutos.
export function getDocumentUrl(documentId: string) {
  return request<DocumentUrl>(
    `/documents/${encodeURIComponent(documentId)}/url`,
  );
}

/** A mesma URL de leitura, mas forçando o download (`attachment`). */
export function downloadUrlOf(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}download=1`;
}

/** Segue para a URL na própria aba (o download não sai da página). */
export function goToUrl(url: string) {
  window.location.assign(url);
}

const FILE_KIND_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'Imagem PNG',
  'image/jpeg': 'Imagem JPG',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'DOCX',
};

/** `PDF · 1,2 MB`: tipo e tamanho do arquivo, como na tabela. */
export function formatFileInfo(mimeType: string, sizeBytes: number) {
  const kind = FILE_KIND_LABELS[mimeType] ?? 'Arquivo';
  const size =
    sizeBytes < 1_048_576
      ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
      : `${(sizeBytes / 1_048_576).toFixed(1).replace('.', ',')} MB`;

  return `${kind} · ${size}`;
}

type UploadOptions = {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

// PUT do arquivo na `uploadUrl` (o próprio backend, com o token na URL). Usa
// XMLHttpRequest porque o fetch não informa o progresso do envio.
export function uploadFile(
  uploadUrl: string,
  file: File,
  { onProgress, signal }: UploadOptions = {},
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', mimeTypeOf(file));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      let code: string | undefined;
      let message: string | undefined;

      try {
        const body = JSON.parse(xhr.responseText) as {
          status?: unknown;
          message?: unknown;
        };

        code = typeof body.status === 'string' ? body.status : undefined;
        message = typeof body.message === 'string' ? body.message : undefined;
      } catch {
        // Corpo vazio ou inválido: só o status HTTP.
      }

      reject(new ApiError(xhr.status, code, message));
    };

    xhr.onerror = () => reject(new Error('Falha de rede no envio do arquivo'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    signal?.addEventListener('abort', () => xhr.abort());

    xhr.send(file);
  });
}
