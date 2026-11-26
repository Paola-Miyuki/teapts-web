import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const push = jest.fn();

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

const CONFIRMED = {
  id: 'doc-1',
  title: 'Laudo neurológico',
  category: 'medical_report',
  mimeType: 'application/pdf',
  sizeBytes: 4,
  createdAt: '2026-12-01T12:00:00.000Z',
};
const PROFESSIONALS = {
  data: [
    {
      id: 'pro-1',
      accountId: 'account-pro-1',
      name: 'Ana Souza',
      specialism: { id: 'psychologist', name: 'Psicólogo' },
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

type Routes = {
  account?: object;
  readOnly?: boolean;
  uploadUrl?: () => Promise<Response>;
  confirm?: () => Promise<Response>;
};

// /me, GET /patients/:id e POST .../upload-url respondem pelos dublês.
function mockApi({
  account = ADMIN,
  readOnly = false,
  uploadUrl = () =>
    Promise.resolve(mockResponse({ status: 201, data: CREATED })),
  confirm = () =>
    Promise.resolve(mockResponse({ status: 201, data: CONFIRMED })),
}: Routes = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.endsWith('/me')) {
      return Promise.resolve(mockResponse({ data: account }));
    }

    if (url.endsWith('/upload-url')) {
      return uploadUrl();
    }

    if (url.endsWith('/documents')) {
      return confirm();
    }

    if (url.includes('/professionals')) {
      return Promise.resolve(mockResponse({ data: PROFESSIONALS }));
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
    (useRouter as jest.Mock).mockReturnValue({ replace, push });
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
        'Tipo de arquivo não permitido. Envie PDF, PNG, JPG, DOC ou DOCX',
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
      await screen.findByText('O arquivo deve ter no máximo 5 MB'),
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

  describe('confirmation (RFDOC002)', () => {
    function confirmCalls() {
      return (global.fetch as jest.Mock).mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith('/documents') && init?.method === 'POST',
      );
    }

    async function uploadFirst() {
      await screen.findByLabelText('Arquivo');
      chooseFile(pdf());
      await screen.findByText('Arquivo enviado.');
    }

    it('keeps the send button disabled until the file is uploaded', async () => {
      mockApi();

      render(<UploadDocumentPage patientId="patient-1" />);
      await screen.findByLabelText('Arquivo');

      expect(
        screen.getByRole('button', { name: 'Enviar documento' }),
      ).toBeDisabled();

      chooseFile(pdf());
      await screen.findByText('Arquivo enviado.');

      expect(
        screen.getByRole('button', { name: 'Enviar documento' }),
      ).toBeEnabled();
    });

    it('validates the required title and category before calling the API', async () => {
      mockApi();
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      expect(
        await screen.findByText('Informe o título do documento'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Escolha a categoria do documento'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Título/)).toHaveFocus();
      expect(confirmCalls()).toHaveLength(0);
    });

    it('confirms with the outside issuer and goes back to the patient', async () => {
      mockApi();
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), ' Laudo neurológico ');
      await user.selectOptions(
        screen.getByLabelText(/Categoria/),
        'medical_report',
      );
      await user.type(screen.getByLabelText('Data de emissão'), '2026-11-20');
      await user.click(screen.getByRole('radio', { name: 'Alguém de fora' }));
      await user.type(
        screen.getByLabelText('Emissor de fora'),
        'Dra. Marta Reis, CRM-PR 12345',
      );
      await user.type(screen.getByLabelText('Descrição'), 'Laudo de 2026');
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith('/patients/patient-1'),
      );

      const [url, init] = confirmCalls()[0];

      expect(url).toBe('http://localhost:3000/patients/patient-1/documents');
      expect(init.credentials).toBe('include');
      expect(JSON.parse(init.body)).toEqual({
        fileKey: CREATED.fileKey,
        title: 'Laudo neurológico',
        category: 'medical_report',
        issueDate: '2026-11-20',
        issuerName: 'Dra. Marta Reis, CRM-PR 12345',
        description: 'Laudo de 2026',
      });
    });

    it('sends only the required fields when the optional ones are empty', async () => {
      mockApi({ account: PROFESSIONAL });
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Receita');
      await user.selectOptions(
        screen.getByLabelText(/Categoria/),
        'prescription',
      );
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(JSON.parse(confirmCalls()[0][1].body)).toEqual({
        fileKey: CREATED.fileKey,
        title: 'Receita',
        category: 'prescription',
      });
    });

    it('shows only the field of the chosen issuer for the admin', async () => {
      mockApi();
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await screen.findByLabelText('Arquivo');

      expect(
        screen.getByPlaceholderText('Busque o profissional pelo nome'),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText('Emissor de fora'),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('radio', { name: 'Alguém de fora' }));

      expect(screen.getByLabelText('Emissor de fora')).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText('Busque o profissional pelo nome'),
      ).not.toBeInTheDocument();
    });

    it('sends the account of the professional the admin picked', async () => {
      mockApi();
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Laudo');
      await user.selectOptions(screen.getByLabelText(/Categoria/), 'exam');
      await user.click(
        screen.getByPlaceholderText('Busque o profissional pelo nome'),
      );
      await user.click(
        await screen.findByRole('option', { name: /Ana Souza/ }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(JSON.parse(confirmCalls()[0][1].body)).toEqual({
        fileKey: CREATED.fileKey,
        title: 'Laudo',
        category: 'exam',
        issuerAccountId: 'account-pro-1',
      });
    });

    it('offers only the outside issuer to the professional and the patient', async () => {
      mockApi({ account: PROFESSIONAL });

      const { unmount } = render(<UploadDocumentPage patientId="patient-1" />);
      await screen.findByLabelText('Emissor de fora');

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText('Busque o profissional pelo nome'),
      ).not.toBeInTheDocument();
      unmount();

      mockApi({ account: PATIENT });
      render(<UploadDocumentPage patientId="patient-1" />);

      expect(
        await screen.findByLabelText('Emissor de fora'),
      ).toBeInTheDocument();
    });

    it('sends the patient back to the home after confirming', async () => {
      mockApi({ account: PATIENT });
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Laudo');
      await user.selectOptions(screen.getByLabelText(/Categoria/), 'exam');
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    });

    it('shows the loading on the button while confirming', async () => {
      mockApi({ confirm: () => new Promise(() => {}) });
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Laudo');
      await user.selectOptions(screen.getByLabelText(/Categoria/), 'exam');
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      const button = await screen.findByRole('button', { name: 'Enviando...' });

      expect(button).toBeDisabled();
      expect(screen.getByLabelText(/Título/)).toBeDisabled();
    });

    it('shows the API message and keeps the form when confirming fails', async () => {
      mockApi({
        confirm: () =>
          Promise.resolve(
            mockResponse({
              status: 403,
              ok: false,
              data: { status: 'FORBIDDEN', message: 'Sem acesso ao paciente.' },
            }),
          ),
      });
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Laudo');
      await user.selectOptions(screen.getByLabelText(/Categoria/), 'exam');
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      expect(
        await screen.findByText('Sem acesso ao paciente.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Título/)).toHaveValue('Laudo');
      expect(push).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Enviar documento' }),
      ).toBeEnabled();
    });

    it('goes back to the file step when the upload is not found', async () => {
      mockApi({
        confirm: () =>
          Promise.resolve(
            mockResponse({
              status: 400,
              ok: false,
              data: {
                status: 'UPLOAD_NOT_FOUND',
                message:
                  'O arquivo não foi encontrado no storage. Envie-o novamente.',
              },
            }),
          ),
      });
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Laudo');
      await user.selectOptions(screen.getByLabelText(/Categoria/), 'exam');
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      expect(
        await screen.findByText(
          'O arquivo não foi encontrado no storage. Envie-o novamente.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('Arquivo enviado.')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Enviar documento' }),
      ).toBeDisabled();
    });

    it('sends to the login when the session expired while confirming', async () => {
      mockApi({
        confirm: () =>
          Promise.resolve(
            mockResponse({
              status: 401,
              ok: false,
              data: { status: 'UNAUTHORISED', message: 'Sessão inválida' },
            }),
          ),
      });
      const user = userEvent.setup();

      render(<UploadDocumentPage patientId="patient-1" />);
      await uploadFirst();
      await user.type(screen.getByLabelText(/Título/), 'Laudo');
      await user.selectOptions(screen.getByLabelText(/Categoria/), 'exam');
      await user.click(
        screen.getByRole('button', { name: 'Enviar documento' }),
      );

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });
});
