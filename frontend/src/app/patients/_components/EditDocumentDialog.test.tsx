import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import type { DocumentMetadata, UpdatedDocument } from '@/lib/documents';
import EditDocumentDialog from './EditDocumentDialog';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const document: DocumentMetadata = {
  id: 'document-1',
  title: 'Laudo neurológico',
  description: 'Avaliação inicial.',
};

const updated: UpdatedDocument = {
  id: document.id,
  title: 'Laudo neurológico (2026)',
  description: 'Avaliação de novembro.',
  updatedAt: '2026-12-09T12:00:00.000Z',
};

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('EditDocumentDialog', () => {
  const replace = jest.fn();
  const onClose = jest.fn();
  const onSaved = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('updates the document metadata without sending file data', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue(respond(200, updated));

    render(
      <EditDocumentDialog
        document={document}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByRole('textbox', { name: /Título/ }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /Título/ }),
      updated.title,
    );
    await user.clear(
      within(dialog).getByRole('textbox', { name: 'Descrição' }),
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Descrição' }),
      updated.description ?? '',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/documents/document-1',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
        }),
      }),
    );
  });

  it('requires a title before submitting', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn();

    render(
      <EditDocumentDialog
        document={document}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByRole('textbox', { name: /Título/ }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      within(dialog).getByText('Informe o título do documento'),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the API error message when the update fails', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Você não tem acesso aos documentos deste paciente.',
      }),
    );

    render(
      <EditDocumentDialog
        document={document}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText(
        'Você não tem acesso aos documentos deste paciente.',
      ),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
