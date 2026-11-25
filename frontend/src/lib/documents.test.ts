import { ApiError } from './api';
import {
  createUploadUrl,
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
      'O arquivo está vazio.',
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
