import { ApiError } from './api';
import {
  categoryLabel,
  createUploadUrl,
  downloadUrlOf,
  formatFileInfo,
  getDocumentUrl,
  getDocuments,
  getMyDocuments,
  FILE_SIZE_ERROR,
  FILE_TYPE_ERROR,
  MAX_FILE_SIZE_BYTES,
  mimeTypeOf,
  uploadFile,
  validateFile,
} from './documents';

function fileOf(name: string, type = '', size = 10) {
  const file = new File(['x'], name, { type });

  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('mimeTypeOf', () => {
  it.each([
    ['laudo.pdf', 'application/pdf', 'application/pdf'],
    ['foto.png', 'image/png', 'image/png'],
    ['foto.jpg', 'image/jpeg', 'image/jpeg'],
    ['relatorio.doc', 'application/msword', 'application/msword'],
  ])('keeps the type the browser reports for %s', (name, type, expected) => {
    expect(mimeTypeOf(fileOf(name, type))).toBe(expected);
  });

  it.each([
    ['laudo.PDF', 'application/pdf'],
    ['foto.jpeg', 'image/jpeg'],
    ['relatorio.doc', 'application/msword'],
    [
      'relatorio.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ])(
    'falls back to the extension of %s when the type is empty',
    (name, expected) => {
      expect(mimeTypeOf(fileOf(name))).toBe(expected);
    },
  );

  it.each([
    ['script.exe', 'application/x-msdownload'],
    ['sem-extensao', ''],
  ])('returns an empty type for %s', (name, type) => {
    expect(mimeTypeOf(fileOf(name, type))).toBe('');
  });
});

describe('validateFile', () => {
  it('accepts an allowed file of up to 5 MB', () => {
    expect(validateFile(fileOf('a.pdf', 'application/pdf', 1))).toBe('');
    expect(
      validateFile(fileOf('a.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES)),
    ).toBe('');
  });

  it('refuses a type outside the list', () => {
    expect(validateFile(fileOf('a.gif', 'image/gif'))).toBe(FILE_TYPE_ERROR);
  });

  it('refuses a file above 5 MB', () => {
    expect(
      validateFile(fileOf('a.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES + 1)),
    ).toBe(FILE_SIZE_ERROR);
  });

  it('refuses an empty file', () => {
    expect(validateFile(fileOf('a.pdf', 'application/pdf', 0))).toBe(
      'O arquivo está vazio',
    );
  });
});

describe('createUploadUrl', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ uploadUrl: 'u', fileKey: 'k', expiresAt: 'e' }),
    });
  });

  it('posts the file data with the session cookies', async () => {
    await createUploadUrl(
      'patient-1',
      fileOf('laudo.pdf', 'application/pdf', 820000),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/patients/patient-1/documents/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'laudo.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 820000,
        }),
        credentials: 'include',
      },
    );
  });
});

describe('listing and reading documents', () => {
  const page = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => page,
    });
  });

  it('lists the documents of a patient with the session cookies', async () => {
    await expect(
      getDocuments('patient-1', { page: 1, limit: 10 }),
    ).resolves.toEqual(page);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/patients/patient-1/documents?page=1&limit=10',
      { signal: undefined, credentials: 'include' },
    );
  });

  it('sends the trimmed search and the categories, and skips the empty filters', async () => {
    await getDocuments('patient-1', {
      page: 2,
      limit: 25,
      q: '  laudo ',
      category: ['tcle', 'image_authorization'],
    });
    await getDocuments('patient-1', {
      page: 1,
      limit: 10,
      q: '  ',
      category: [],
    });

    const urls = jest.mocked(global.fetch).mock.calls.map(([url]) => url);

    expect(urls[0]).toBe(
      'http://localhost:3000/patients/patient-1/documents?page=2&limit=25&q=laudo&category=tcle%2Cimage_authorization',
    );
    expect(urls[1]).toBe(
      'http://localhost:3000/patients/patient-1/documents?page=1&limit=10',
    );
  });

  it('lists only what the patient sent', async () => {
    await getMyDocuments({ page: 1, limit: 10, q: 'laudo' });

    expect(jest.mocked(global.fetch).mock.calls[0][0]).toBe(
      'http://localhost:3000/me/documents?page=1&limit=10&q=laudo',
    );
  });

  it('asks for the temporary read url of a document', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        url: 'http://api/storage/objects/k?token=t',
        expiresAt: 'e',
      }),
    });

    await expect(getDocumentUrl('doc-1')).resolves.toEqual({
      url: 'http://api/storage/objects/k?token=t',
      expiresAt: 'e',
    });
    expect(jest.mocked(global.fetch).mock.calls[0][0]).toBe(
      'http://localhost:3000/documents/doc-1/url',
    );
  });

  it('turns the read url into a download url', () => {
    expect(downloadUrlOf('http://api/storage/objects/k?token=t')).toBe(
      'http://api/storage/objects/k?token=t&download=1',
    );
    expect(downloadUrlOf('http://api/x')).toBe('http://api/x?download=1');
  });

  it.each([
    ['application/pdf', 1_258_291, 'PDF · 1,2 MB'],
    ['image/jpeg', 215_040, 'Imagem JPG · 210 KB'],
    ['application/msword', 10, 'DOC · 1 KB'],
    ['text/plain', 2_097_152, 'Arquivo · 2,0 MB'],
  ])('describes %s with %i bytes as "%s"', (mimeType, size, expected) => {
    expect(formatFileInfo(mimeType, size)).toBe(expected);
  });

  it('labels the categories', () => {
    expect(categoryLabel('medical_report')).toBe('Laudo médico');
    expect(categoryLabel('unknown')).toBe('unknown');
  });
});

class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  responseText = '';
  upload: { onprogress?: (event: unknown) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  aborted = false;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe('uploadFile', () => {
  const original = global.XMLHttpRequest;
  const file = fileOf('laudo.pdf', 'application/pdf', 100);

  beforeEach(() => {
    global.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    global.XMLHttpRequest = original;
  });

  it('puts the file on the url with its type and reports the progress', async () => {
    const progress: number[] = [];
    const done = uploadFile('http://api/storage/objects/k?token=t', file, {
      onProgress: (percent) => progress.push(percent),
    });
    const xhr = FakeXhr.last;

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.status = 204;
    xhr.onload?.();

    await expect(done).resolves.toBeUndefined();
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('http://api/storage/objects/k?token=t');
    expect(xhr.headers['Content-Type']).toBe('application/pdf');
    expect(xhr.body).toBe(file);
    expect(progress).toEqual([25, 100]);
  });

  it('rejects with the error code and message of the API', async () => {
    const done = uploadFile('http://api/u', file);
    const xhr = FakeXhr.last;

    xhr.status = 403;
    xhr.responseText = JSON.stringify({
      status: 'UPLOAD_URL_INVALID',
      message: 'A URL de envio é inválida ou venceu.',
    });
    xhr.onload?.();

    await expect(done).rejects.toMatchObject({
      status: 403,
      code: 'UPLOAD_URL_INVALID',
      apiMessage: 'A URL de envio é inválida ou venceu.',
    });
    await expect(done).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects with only the status when the body is not JSON', async () => {
    const done = uploadFile('http://api/u', file);

    FakeXhr.last.status = 502;
    FakeXhr.last.responseText = '<html>';
    FakeXhr.last.onload?.();

    await expect(done).rejects.toMatchObject({ status: 502 });
  });

  it('rejects on a network failure', async () => {
    const done = uploadFile('http://api/u', file);

    FakeXhr.last.onerror?.();

    await expect(done).rejects.toThrow('Falha de rede');
  });

  it('aborts the request when the signal is aborted', async () => {
    const controller = new AbortController();
    const done = uploadFile('http://api/u', file, {
      signal: controller.signal,
    });

    controller.abort();

    await expect(done).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.last.aborted).toBe(true);
  });
});
