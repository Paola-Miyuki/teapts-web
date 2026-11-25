import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { goToUrl } from '@/lib/documents';

import DocumentsTab from './DocumentsTab';
import TermsTab from './TermsTab';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/documents', () => ({
  ...jest.requireActual('@/lib/documents'),
  goToUrl: jest.fn(),
}));

const API = 'http://localhost:3000';

const LAUDO = {
  id: 'doc-1',
  title: 'Laudo neurológico',
  description: 'Avaliação inicial.',
  category: 'medical_report',
  issuer: {
    name: 'Dra. Marta Reis',
    specialism: 'neurologist',
    institution: 'IMA',
    outsideSystem: false,
  },
  issueDate: '2026-01-22',
  mimeType: 'application/pdf',
  sizeBytes: 1_258_291,
  uploadedBy: { id: 'a1', name: 'Ana Clara Ribeiro', isPatient: true },
  createdAt: '2026-02-14T12:00:00.000Z',
};
const EXAME = {
  ...LAUDO,
  id: 'doc-2',
  title: 'Audiometria tonal',
  category: 'exam',
  issuer: { name: 'Clínica Audire', outsideSystem: true },
  issueDate: null,
  mimeType: 'image/jpeg',
  sizeBytes: 215_040,
  uploadedBy: { id: 'a2', name: 'João Lima', isPatient: false },
};
const TCLE = {
  ...LAUDO,
  id: 'doc-3',
  title: 'Termo de consentimento do PTS',
  category: 'tcle',
  issuer: null,
  createdAt: '2026-03-03T12:00:00.000Z',
};

function list(data: unknown[], page = 1, total = data.length, limit = 10) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function urls() {
  return jest.mocked(global.fetch).mock.calls.map(([url]) => String(url));
}

describe('DocumentsTab', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('loads the documents without the terms and shows the columns of the layout', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(respond(200, list([LAUDO, EXAME])));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    expect(await screen.findByText('Laudo neurológico')).toBeInTheDocument();
    expect(urls()[0]).toBe(
      `${API}/patients/patient-1/documents?page=1&limit=10&category=medical_report%2Cexam%2Cprescription%2Ctherapy_report%2Cschool_report%2Cpei%2Cdischarge_report%2Cother`,
    );
    expect(screen.getByText('2 documentos')).toBeInTheDocument();

    const first = screen.getByRole('row', { name: /Laudo neurológico/ });

    expect(within(first).getByText('PDF · 1,2 MB')).toBeInTheDocument();
    expect(within(first).getByText('Laudo médico')).toBeInTheDocument();
    expect(
      within(first).getByText('Dra. Marta Reis (IMA)'),
    ).toBeInTheDocument();
    expect(within(first).getByText('Neurologista')).toBeInTheDocument();
    expect(within(first).getByText('22/01/2026')).toBeInTheDocument();
    expect(
      within(first).getByText('Ana Clara Ribeiro (paciente)'),
    ).toBeInTheDocument();
    expect(within(first).getByText('14/02/2026')).toBeInTheDocument();

    const second = screen.getByRole('row', { name: /Audiometria tonal/ });

    expect(within(second).getByText('Fora do sistema')).toBeInTheDocument();
    expect(within(second).getByText('Imagem JPG · 210 KB')).toBeInTheDocument();
    expect(within(second).getByText('João Lima')).toBeInTheDocument();
    expect(
      within(second).getByLabelText('Não informado', { selector: 'span' }),
    ).toBeInTheDocument();
  });

  it('shows the upload link only when the user can upload', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(200, list([LAUDO])));

    const { rerender } = render(
      <DocumentsTab patientId="patient-1" canUpload />,
    );

    expect(
      await screen.findByRole('link', { name: 'Enviar documento' }),
    ).toHaveAttribute('href', '/patients/patient-1/documents/new');

    rerender(<DocumentsTab patientId="patient-1" canUpload={false} />);

    expect(
      screen.queryByRole('link', { name: 'Enviar documento' }),
    ).not.toBeInTheDocument();
  });

  it('edits document metadata from the row and updates the table', async () => {
    const user = userEvent.setup();
    const updated = {
      id: 'doc-1',
      title: 'Laudo neurológico (2026)',
      description: 'Avaliação de novembro.',
      updatedAt: '2026-12-09T12:00:00.000Z',
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respond(200, list([LAUDO])))
      .mockResolvedValueOnce(respond(200, updated));

    render(
      <DocumentsTab patientId="patient-1" canUpload={false} canEditDocuments />,
    );

    await screen.findByText('Laudo neurológico');
    await user.click(
      screen.getByRole('button', { name: 'Ações para Laudo neurológico' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    const dialog = screen.getByRole('dialog');
    const title = within(dialog).getByRole('textbox', { name: /Título/ });
    const description = within(dialog).getByRole('textbox', {
      name: 'Descrição',
    });

    expect(title).toHaveValue('Laudo neurológico');
    expect(description).toHaveValue('Avaliação inicial.');

    await user.clear(title);
    await user.type(title, updated.title);
    await user.clear(description);
    await user.type(description, updated.description);
    await user.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      await screen.findByText('Laudo neurológico (2026)'),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith(
      `${API}/documents/doc-1`,
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
        }),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('searches by the title and goes back to the first page', async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockResolvedValue(respond(200, list([LAUDO])));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    await screen.findByText('Laudo neurológico');
    await user.type(
      screen.getByPlaceholderText('Título do documento'),
      'laudo',
    );

    await waitFor(() => expect(urls().at(-1)).toContain('&q=laudo'));
    expect(
      await screen.findByText(/com os filtros atuais/),
    ).toBeInTheDocument();
  });

  it('filters by category and clears the filter', async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockResolvedValue(respond(200, list([EXAME])));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    await screen.findByText('Audiometria tonal');
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.click(screen.getByLabelText('Exame'));

    await waitFor(() =>
      expect(urls().at(-1)).toBe(
        `${API}/patients/patient-1/documents?page=1&limit=10&category=exam`,
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Limpar' }));

    await waitFor(() => expect(urls().at(-1)).toContain('medical_report'));
  });

  it('paginates the table', async () => {
    const user = userEvent.setup();

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respond(200, list([LAUDO], 1, 12)))
      .mockResolvedValue(respond(200, list([EXAME], 2, 12)));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    await screen.findByText('Laudo neurológico');
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(await screen.findByText('Audiometria tonal')).toBeInTheDocument();
    expect(urls().at(-1)).toContain('page=2&limit=10');
  });

  it('shows the empty state, with and without filters', async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockResolvedValue(respond(200, list([])));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    expect(
      await screen.findByText('Nenhum documento enviado'),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Título do documento'), 'xyz');

    expect(
      await screen.findByText('Nenhum documento encontrado'),
    ).toBeInTheDocument();
  });

  it('shows the API message on a load error and retries', async () => {
    const user = userEvent.setup();

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        respond(403, {
          status: 'FORBIDDEN',
          message: 'Você não tem acesso aos documentos deste paciente.',
        }),
      )
      .mockResolvedValue(respond(200, list([LAUDO])));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    expect(
      await screen.findByText(
        'Você não tem acesso aos documentos deste paciente.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Laudo neurológico')).toBeInTheDocument();
  });

  it('goes to the login on a 401', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(401, {}));

    render(<DocumentsTab patientId="patient-1" canUpload />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  describe('delete', () => {
    async function openDelete(user: ReturnType<typeof userEvent.setup>) {
      await screen.findByText('Laudo neurológico');
      await user.click(
        screen.getByRole('button', { name: 'Ações para Laudo neurológico' }),
      );
    }

    it('deletes the document after the confirmation and reloads the list', async () => {
      const user = userEvent.setup();
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(respond(200, list([LAUDO, EXAME])))
        .mockResolvedValueOnce(
          respond(200, { id: 'doc-1', deletedAt: '2026-12-09T12:00:00.000Z' }),
        )
        .mockResolvedValueOnce(respond(200, list([EXAME])));

      render(
        <DocumentsTab
          patientId="patient-1"
          canUpload={false}
          canEditDocuments
          canDeleteDocuments
        />,
      );

      await openDelete(user);
      await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));

      const dialog = screen.getByRole('dialog');

      expect(
        within(dialog).getByText('Excluir "Laudo neurológico"?'),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(/O arquivo não é apagado/),
      ).toBeInTheDocument();

      await user.click(
        within(dialog).getByRole('button', { name: 'Excluir documento' }),
      );

      await waitFor(() =>
        expect(screen.queryByText('Laudo neurológico')).not.toBeInTheDocument(),
      );
      expect(screen.getByText('1 documento')).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/documents/doc-1`,
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows Excluir only to whoever can delete', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn().mockResolvedValue(respond(200, list([LAUDO])));

      render(
        <DocumentsTab
          patientId="patient-1"
          canUpload={false}
          canEditDocuments
        />,
      );

      await openDelete(user);

      expect(
        screen.queryByRole('menuitem', { name: 'Excluir' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('Só o administrador exclui documentos.'),
      ).toBeInTheDocument();
    });

    it('keeps the dialog open with the API message on error', async () => {
      const user = userEvent.setup();
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(respond(200, list([LAUDO])))
        .mockResolvedValueOnce(
          respond(404, {
            status: 'DOCUMENT_NOT_FOUND',
            message: 'Documento não encontrado.',
          }),
        );

      render(
        <DocumentsTab
          patientId="patient-1"
          canUpload={false}
          canDeleteDocuments
        />,
      );

      await openDelete(user);
      await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
      await user.click(
        screen.getByRole('button', { name: 'Excluir documento' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Documento não encontrado.',
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Laudo neurológico')).toBeInTheDocument();
    });

    it('shows the loading state while deleting', async () => {
      const user = userEvent.setup();
      let finish: (response: Response) => void = () => undefined;
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(respond(200, list([LAUDO])))
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
        )
        .mockResolvedValue(respond(200, list([])));

      render(
        <DocumentsTab
          patientId="patient-1"
          canUpload={false}
          canDeleteDocuments
        />,
      );

      await openDelete(user);
      await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
      await user.click(
        screen.getByRole('button', { name: 'Excluir documento' }),
      );

      expect(
        await screen.findByRole('button', { name: 'Excluindo...' }),
      ).toBeDisabled();

      finish(respond(200, { id: 'doc-1', deletedAt: '2026-12-09T12:00:00Z' }));

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
    });
  });

  describe('view and download', () => {
    let tab: { location: { href: string }; opener: unknown; close: jest.Mock };

    beforeEach(() => {
      tab = { location: { href: '' }, opener: {}, close: jest.fn() };
      jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    });

    function mockApi(urlResponse: Response) {
      global.fetch = jest.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/url') ? urlResponse : respond(200, list([LAUDO])),
        ),
      ) as jest.Mock;
    }

    it('opens the temporary url in a new tab on "Visualizar"', async () => {
      const user = userEvent.setup();

      mockApi(
        respond(200, {
          url: `${API}/storage/objects/k?token=t`,
          expiresAt: '2026-12-01T12:05:00.000Z',
        }),
      );

      render(<DocumentsTab patientId="patient-1" canUpload />);

      await screen.findByText('Laudo neurológico');
      await user.click(
        screen.getByRole('button', { name: 'Ações para Laudo neurológico' }),
      );
      expect(
        screen.queryByRole('menuitem', { name: 'Editar' }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole('menuitem', { name: 'Visualizar' }));

      await waitFor(() =>
        expect(tab.location.href).toBe(`${API}/storage/objects/k?token=t`),
      );
      expect(tab.opener).toBeNull();
      expect(urls()).toContain(`${API}/documents/doc-1/url`);
    });

    it('downloads through the url with download=1 on "Baixar"', async () => {
      const user = userEvent.setup();

      mockApi(
        respond(200, {
          url: `${API}/storage/objects/k?token=t`,
          expiresAt: '2026-12-01T12:05:00.000Z',
        }),
      );

      render(<DocumentsTab patientId="patient-1" canUpload />);

      await screen.findByText('Laudo neurológico');
      await user.click(
        screen.getByRole('button', { name: 'Ações para Laudo neurológico' }),
      );
      await user.click(screen.getByRole('menuitem', { name: 'Baixar' }));

      await waitFor(() =>
        expect(goToUrl).toHaveBeenCalledWith(
          `${API}/storage/objects/k?token=t&download=1`,
        ),
      );
      expect(window.open).not.toHaveBeenCalled();
    });

    it('shows the API message and closes the tab when the url fails', async () => {
      const user = userEvent.setup();

      mockApi(
        respond(404, {
          status: 'DOCUMENT_NOT_FOUND',
          message: 'Documento não encontrado.',
        }),
      );

      render(<DocumentsTab patientId="patient-1" canUpload />);

      await screen.findByText('Laudo neurológico');
      await user.click(
        screen.getByRole('button', { name: 'Ações para Laudo neurológico' }),
      );
      await user.click(screen.getByRole('menuitem', { name: 'Visualizar' }));

      expect(
        await screen.findByText('Documento não encontrado.'),
      ).toBeInTheDocument();
      expect(tab.close).toHaveBeenCalled();
    });
  });
});

describe('TermsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
  });

  function mockTerms(tcle: unknown[], image: unknown[], table = list([TCLE])) {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('limit=1&category=tcle')) {
        return Promise.resolve(respond(200, list(tcle)));
      }

      if (url.includes('limit=1&category=image_authorization')) {
        return Promise.resolve(respond(200, list(image)));
      }

      return Promise.resolve(respond(200, table));
    }) as jest.Mock;
  }

  it('shows the TCLE as sent and the image authorization as pending', async () => {
    mockTerms([TCLE], []);

    render(<TermsTab patientId="patient-1" canUpload />);

    expect(
      await screen.findByText(/enviado em 03\/03\/2026/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver TCLE' })).toBeVisible();
    expect(
      screen.getByText('Pendente · necessária para gravar sessões'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Enviar Autorização de uso de imagem' }),
    ).toHaveAttribute('href', '/patients/patient-1/documents/new');
  });

  it('lists only the terms in the table, with their categories as filter', async () => {
    const user = userEvent.setup();

    mockTerms([TCLE], []);

    render(<TermsTab patientId="patient-1" canUpload />);

    expect(
      await screen.findByText('Termo de consentimento do PTS'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 termo')).toBeInTheDocument();
    expect(urls()).toContain(
      `${API}/patients/patient-1/documents?page=1&limit=10&category=tcle%2Cimage_authorization`,
    );

    await user.click(screen.getByRole('button', { name: 'Filtros' }));

    expect(screen.getByLabelText('TCLE')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Autorização de uso de imagem'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Exame')).not.toBeInTheDocument();
  });

  it('hides the upload buttons when the user cannot upload', async () => {
    mockTerms([], []);

    render(<TermsTab patientId="patient-1" canUpload={false} />);

    await screen.findAllByText('Pendente · necessária para gravar sessões');

    expect(
      screen.queryByRole('link', { name: /Enviar/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the error of the situation with a retry', async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn((url: string) =>
      Promise.resolve(
        url.includes('limit=1')
          ? respond(500, { status: 'ERROR', message: 'Falha interna.' })
          : respond(200, list([])),
      ),
    ) as jest.Mock;

    render(<TermsTab patientId="patient-1" canUpload />);

    expect(
      (await screen.findAllByText('Falha interna.')).length,
    ).toBeGreaterThan(0);

    mockTerms([TCLE], []);
    await user.click(
      screen.getAllByRole('button', { name: 'Tentar novamente' })[0],
    );

    expect(
      await screen.findByText(/enviado em 03\/03\/2026/),
    ).toBeInTheDocument();
  });
});
