import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/documents';
import UploadDocumentPage from './UploadDocumentPage';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/patients/patient-1/documents/new'),
}));

jest.mock('@/lib/documents', () => ({
  ...jest.requireActual('@/lib/documents'),
  uploadFile: jest.fn(),
}));

const mockedUploadFile = uploadFile as jest.Mock;
const replace = jest.fn();

function mockResponse({
  status = 200,
  ok = true,
  data,
}: {
  status?: number;
  ok?: boolean;
  data?: unknown;
}) {
  return {
    status,
    ok,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

const ADMIN = {
  accountId: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  patientProfileId: null,
  professionalProfileIds: [],
};
const PROFESSIONAL = {
  ...ADMIN,
  role: 'user',
  professionalProfileIds: ['pro-1'],
};
const PATIENT = {
  ...ADMIN,
  role: 'user',
  patientProfileId: 'patient-1',
};
const CREATED = {
  uploadUrl: 'http://localhost:3000/storage/objects/k?token=t',
  fileKey: 'patient-1/abc-laudo.pdf',
  expiresAt: '2026-12-01T12:15:00.000Z',
};

type Routes = {
  account?: object;
  readOnly?: boolean;
  uploadUrl?: () => Promise<Response>;
};

// /me, GET /patients/:id e POST .../upload-url respondem pelos dublês.
function mockApi({
  account = ADMIN,
  readOnly = false,
  uploadUrl = () =>
    Promise.resolve(mockResponse({ status: 201, data: CREATED })),
}: Routes = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.endsWith('/me')) {
      return Promise.resolve(mockResponse({ data: account }));
    }

    if (url.endsWith('/upload-url')) {
      return uploadUrl();
    }

    return Promise.resolve(
      mockResponse({ data: { id: 'patient-1', name: 'Ana', readOnly } }),
    );
  });
}

function uploadCalls() {
  return (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
    String(url).endsWith('/upload-url'),
  );
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Arquivo'), {
    target: { files: [file] },
  });
}

const pdf = () => new File(['%PDF'], 'laudo.pdf', { type: 'application/pdf' });

describe('UploadDocumentPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    global.fetch = jest.fn();
    mockedUploadFile.mockResolvedValue(undefined);
  });

  it('asks for the url, sends the file with progress and shows it as sent', async () => {
    mockApi();
    mockedUploadFile.mockImplementation(
      async (
        _url: string,
        _file: File,
        { onProgress }: { onProgress: (percent: number) => void },
      ) => {
        onProgress(40);
      },
    );

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(await screen.findByText('Arquivo enviado.')).toBeInTheDocument();

    const [url, init] = uploadCalls()[0];

    expect(url).toBe(
      'http://localhost:3000/patients/patient-1/documents/upload-url',
    );
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({
      fileName: 'laudo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
    });
    expect(mockedUploadFile).toHaveBeenCalledWith(
      CREATED.uploadUrl,
      expect.any(File),
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.getByText('laudo.pdf')).toBeInTheDocument();
  });

  it('shows the loading and the progress while sending', async () => {
    mockApi();
    mockedUploadFile.mockImplementation(
      (
        _url: string,
        _file: File,
        { onProgress }: { onProgress: (percent: number) => void },
      ) => {
        onProgress(40);
        return new Promise(() => {});
      },
    );

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(await screen.findByText('Enviando... 40%')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Progresso do envio' }),
    ).toHaveValue(40);
    expect(screen.getByLabelText('Arquivo')).toBeDisabled();
  });

  it('shows the preparing state while the url is requested', async () => {
    mockApi({ uploadUrl: () => new Promise(() => {}) });

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(
      await screen.findByText('Preparando o envio...'),
    ).toBeInTheDocument();
  });

  it('refuses a type outside the list before asking for the url', async () => {
    mockApi();

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(new File(['x'], 'foto.gif', { type: 'image/gif' }));

    expect(
      await screen.findByText(
        'Tipo de arquivo não permitido. Envie PDF, PNG, JPG, DOC ou DOCX.',
      ),
    ).toBeInTheDocument();
    expect(uploadCalls()).toHaveLength(0);
    expect(mockedUploadFile).not.toHaveBeenCalled();
  });

  it('refuses a file above 5 MB before asking for the url', async () => {
    mockApi();
    const big = pdf();

    Object.defineProperty(big, 'size', { value: 5_242_881 });

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(big);

    expect(
      await screen.findByText('O arquivo deve ter no máximo 5 MB.'),
    ).toBeInTheDocument();
    expect(uploadCalls()).toHaveLength(0);
  });

  it('asks for a new url once when the first one has expired', async () => {
    mockApi();
    mockedUploadFile
      .mockRejectedValueOnce(new ApiError(403, 'UPLOAD_URL_INVALID', 'Venceu'))
      .mockResolvedValueOnce(undefined);

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(await screen.findByText('Arquivo enviado.')).toBeInTheDocument();
    expect(uploadCalls()).toHaveLength(2);
    expect(mockedUploadFile).toHaveBeenCalledTimes(2);
  });

  it('shows the error when the second url also fails', async () => {
    mockApi();
    mockedUploadFile.mockRejectedValue(
      new ApiError(403, 'UPLOAD_URL_INVALID', 'A URL de envio venceu.'),
    );

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(
      await screen.findByText('A URL de envio venceu.'),
    ).toBeInTheDocument();
    expect(uploadCalls()).toHaveLength(2);
  });

  it('shows the API message when asking for the url fails', async () => {
    mockApi({
      uploadUrl: () =>
        Promise.resolve(
          mockResponse({
            status: 403,
            ok: false,
            data: {
              status: 'FORBIDDEN',
              message: 'Você não tem acesso aos documentos deste paciente.',
            },
          }),
        ),
    });

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(
      await screen.findByText(
        'Você não tem acesso aos documentos deste paciente.',
      ),
    ).toBeInTheDocument();
    expect(mockedUploadFile).not.toHaveBeenCalled();
  });

  it('shows a generic message on a network failure', async () => {
    mockApi();
    mockedUploadFile.mockRejectedValue(new Error('Falha de rede'));

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    expect(
      await screen.findByText('Não foi possível enviar o arquivo'),
    ).toBeInTheDocument();
  });

  it('sends to the login when the session expired', async () => {
    mockApi({
      uploadUrl: () =>
        Promise.resolve(
          mockResponse({
            status: 401,
            ok: false,
            data: { status: 'UNAUTHORISED', message: 'Sessão inválida' },
          }),
        ),
    });

    render(<UploadDocumentPage patientId="patient-1" />);
    await screen.findByLabelText('Arquivo');
    chooseFile(pdf());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('lets a professional with an active PTS send', async () => {
    mockApi({ account: PROFESSIONAL, readOnly: false });

    render(<UploadDocumentPage patientId="patient-1" />);

    expect(await screen.findByLabelText('Arquivo')).toBeInTheDocument();
  });

  it('blocks a professional whose PTS is concluded or cancelled', async () => {
    mockApi({ account: PROFESSIONAL, readOnly: true });

    render(<UploadDocumentPage patientId="patient-1" />);

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByLabelText('Arquivo')).not.toBeInTheDocument();
  });

  it('lets the patient send to their own id and blocks another id', async () => {
    mockApi({ account: PATIENT });

    const { unmount } = render(<UploadDocumentPage patientId="patient-1" />);

    expect(await screen.findByLabelText('Arquivo')).toBeInTheDocument();
    unmount();

    render(<UploadDocumentPage patientId="patient-2" />);

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
  });
});
