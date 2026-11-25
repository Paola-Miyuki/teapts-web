import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { goToUrl } from '@/lib/documents';
import { personalData } from '@/test-utils/account';

import Page from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/documents', () => ({
  ...jest.requireActual('@/lib/documents'),
  goToUrl: jest.fn(),
}));

const API = 'http://localhost:3000';

const PATIENT_ACCOUNT: Account = {
  accountId: 'account-patient-1',
  name: 'Ana Paciente',
  email: 'ana@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};

const LAUDO = {
  id: 'doc-1',
  title: 'Laudo escolar',
  category: 'school_report',
  issuer: { name: 'Profa. Carla Dias', outsideSystem: true },
  issueDate: '2026-02-10',
  mimeType: 'application/pdf',
  sizeBytes: 820_000,
  uploadedBy: {
    id: 'account-patient-1',
    name: 'Ana Paciente',
    isPatient: true,
  },
  createdAt: '2026-02-14T12:00:00.000Z',
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function list(data: unknown[], total = data.length) {
  return {
    data,
    pagination: { page: 1, limit: 10, total, totalPages: 1 },
  };
}

function urls() {
  return jest.mocked(global.fetch).mock.calls.map(([url]) => String(url));
}

describe('MyDocumentsPage', () => {
  const replace = jest.fn();
  let account: Account;
  let documents: Response;

  beforeEach(() => {
    jest.clearAllMocks();
    account = PATIENT_ACCOUNT;
    documents = respond(200, list([LAUDO]));
    (useRouter as jest.Mock).mockReturnValue({ replace });

    global.fetch = jest.fn((url: string) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(respond(200, account));
      }

      if (url.includes('/me/documents')) {
        return Promise.resolve(documents);
      }

      if (url.endsWith('/documents/doc-1/url')) {
        return Promise.resolve(
          respond(200, {
            url: `${API}/storage/objects/k?token=t`,
            expiresAt: '2026-12-01T12:05:00.000Z',
          }),
        );
      }

      throw new Error(`Requisição inesperada: ${url}`);
    }) as jest.Mock;
  });

  it('lists only what the patient sent, without the uploader column, and links to the upload', async () => {
    render(<Page />);

    expect(await screen.findByText('Laudo escolar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeVisible();
    expect(screen.getByText('Meus documentos')).toBeInTheDocument();
    expect(screen.getByText('1 documento')).toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual([
      'Documento',
      'Categoria',
      'Emitido por',
      'Data de emissão',
      'Enviado em',
      'Ações',
    ]);

    const row = screen.getByRole('row', { name: /Laudo escolar/ });

    expect(within(row).getByText('Relatório escolar')).toBeInTheDocument();
    expect(within(row).getByText('Fora do sistema')).toBeInTheDocument();
    expect(within(row).getByText('10/02/2026')).toBeInTheDocument();
    expect(within(row).getByText('14/02/2026')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Enviar documento' }),
    ).toHaveAttribute('href', '/patients/patient-1/documents/new');
    expect(screen.getByRole('link', { name: 'Documentos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(urls()).toContain(
      `${API}/me/documents?page=1&limit=10&category=${[
        'medical_report',
        'exam',
        'prescription',
        'therapy_report',
        'school_report',
        'pei',
        'discharge_report',
        'tcle',
        'image_authorization',
        'other',
      ].join('%2C')}`,
    );
  });

  it('offers only view and download, with no edit or delete', async () => {
    const user = userEvent.setup();

    render(<Page />);

    await screen.findByText('Laudo escolar');
    await user.click(
      screen.getByRole('button', { name: 'Ações para Laudo escolar' }),
    );

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent?.trim()),
    ).toEqual(['Visualizar', 'Baixar']);
    expect(
      screen.queryByRole('button', { name: /Editar|Excluir/ }),
    ).not.toBeInTheDocument();
  });

  it('downloads through the temporary link', async () => {
    const user = userEvent.setup();

    render(<Page />);

    await screen.findByText('Laudo escolar');
    await user.click(
      screen.getByRole('button', { name: 'Ações para Laudo escolar' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Baixar' }));

    await waitFor(() =>
      expect(goToUrl).toHaveBeenCalledWith(
        `${API}/storage/objects/k?token=t&download=1`,
      ),
    );
  });

  it('searches by the title and filters by category', async () => {
    const user = userEvent.setup();

    render(<Page />);

    await screen.findByText('Laudo escolar');
    await user.type(
      screen.getByPlaceholderText('Título do documento'),
      'laudo',
    );
    await waitFor(() => expect(urls().at(-1)).toContain('&q=laudo'));

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.click(screen.getByLabelText('PEI'));

    await waitFor(() => expect(urls().at(-1)).toContain('&category=pei'));
  });

  it('shows the empty state', async () => {
    documents = respond(200, list([]));

    render(<Page />);

    expect(
      await screen.findByText('Nenhum documento enviado'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 documentos')).toBeInTheDocument();
  });

  it('shows the API message and retries when the load fails', async () => {
    const user = userEvent.setup();

    documents = respond(403, {
      status: 'FORBIDDEN',
      message: 'Só o paciente consulta os próprios documentos.',
    });

    render(<Page />);

    expect(
      await screen.findByText('Só o paciente consulta os próprios documentos.'),
    ).toBeInTheDocument();

    documents = respond(200, list([LAUDO]));
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Laudo escolar')).toBeInTheDocument();
  });

  it('blocks the screen for the team (admin and professional)', async () => {
    account = { ...PATIENT_ACCOUNT, role: 'admin', patientProfileId: null };

    render(<Page />);

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(urls().some((url) => url.includes('/me/documents'))).toBe(false);
  });
});
