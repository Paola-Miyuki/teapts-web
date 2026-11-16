import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';

import PtsOverview from './_components/PtsOverview';

const mockReplace = jest.fn();
// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: mockReplace, push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PTS_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const PATCH_URL = `http://localhost:3000/pts/${PTS_ID}/social-situation`;
const CURRENT_TEXT = 'Mora com a mãe e frequenta a escola municipal.';
const NEW_TEXT = 'Mora com a mãe e a avó; iniciou acompanhamento no CAPS.';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function professionalAccount(professionalId = RESPONSIBLE_ID): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Profissional',
    email: 'profissional@example.com',
    role: 'user',
    patientProfileId: null,
    professionalProfileIds: [professionalId],
  };
}

function patientAccount(): Account {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Priscila Martins',
    email: 'paciente@example.com',
    role: 'user',
    patientProfileId: PATIENT_ID,
    professionalProfileIds: [],
  };
}

function activePts(overrides: Record<string, unknown> = {}) {
  return {
    id: PTS_ID,
    status: 'planning',
    socialSituation: CURRENT_TEXT,
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: '2026-10-15T12:30:00.000Z',
    beganAt: null,
    patient: { id: PATIENT_ID, name: 'Priscila Martins' },
    responsible: {
      id: RESPONSIBLE_ID,
      name: 'Kaio Segunda Conta',
      specialism: { id: 'psychologist', name: 'Psicologia' },
    },
    team: [
      {
        id: MEMBER_ID,
        name: 'Integrante Teste',
        specialism: { id: 'doctor', name: 'Medicina' },
      },
    ],
    ...overrides,
  };
}

// Carrega o PTS ativo e abre o diálogo "Situação social".
async function openDialog(account = professionalAccount()) {
  render(<PtsOverview account={account} patientId={PATIENT_ID} />);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Editar situação social' }),
  );

  return screen.findByRole('dialog', { name: 'Situação social' });
}

describe('Situação social (RFPTS005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts()),
    );
  });

  it('mostra "Editar situação social" para o responsável e para o membro da equipe', async () => {
    const { unmount } = render(
      <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
    );

    expect(
      await screen.findByRole('button', { name: 'Editar situação social' }),
    ).toBeInTheDocument();
    unmount();

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts()),
    );
    render(
      <PtsOverview
        account={professionalAccount(MEMBER_ID)}
        patientId={PATIENT_ID}
      />,
    );

    expect(
      await screen.findByRole('button', { name: 'Editar situação social' }),
    ).toBeInTheDocument();
  });

  it('não mostra o botão para o paciente nem para profissional fora da equipe', async () => {
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts({ socialSituation: undefined })),
    );

    const { unmount } = render(
      <PtsOverview account={patientAccount()} patientId={PATIENT_ID} />,
    );

    expect(await screen.findByText('Sobre este plano')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar situação social' }),
    ).not.toBeInTheDocument();
    unmount();

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts()),
    );
    render(
      <PtsOverview
        account={professionalAccount('99999999-9999-4999-8999-999999999999')}
        patientId={PATIENT_ID}
      />,
    );

    expect(await screen.findByText('Situação social')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar situação social' }),
    ).not.toBeInTheDocument();
  });

  it('abre o diálogo com a situação social atual', async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByLabelText('Descrição')).toHaveValue(
      CURRENT_TEXT,
    );
  });

  it('valida o texto obrigatório sem chamar a API', async () => {
    const dialog = await openDialog();
    const textarea = within(dialog).getByLabelText('Descrição');

    await userEvent.clear(textarea);
    await userEvent.type(textarea, '   ');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alteração' }),
    );

    expect(
      within(dialog).getByText('Informe a situação social.'),
    ).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('salva, fecha o diálogo, atualiza o texto e mostra o aviso', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ id: PTS_ID, socialSituation: NEW_TEXT }),
    );

    const dialog = await openDialog();
    const textarea = within(dialog).getByLabelText('Descrição');

    await userEvent.clear(textarea);
    await userEvent.type(textarea, `  ${NEW_TEXT}  `);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alteração' }),
    );

    expect(
      await screen.findByText('Situação social atualizada.'),
    ).toBeInTheDocument();
    expect(screen.getByText(NEW_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(CURRENT_TEXT)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Situação social' }),
    ).not.toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(PATCH_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socialSituation: NEW_TEXT }),
      credentials: 'include',
    });
  });

  it('mostra o loading no botão e bloqueia o envio duplicado', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alteração' }),
    );

    const saving = within(dialog).getByRole('button', { name: 'Salvando...' });

    expect(saving).toBeDisabled();
    expect(within(dialog).getByLabelText('Descrição')).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('exibe a mensagem da API no diálogo (403)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        {
          status: 'FORBIDDEN',
          message:
            'Somente profissionais da equipe podem alterar a situação social.',
        },
        403,
      ),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alteração' }),
    );

    expect(
      await within(dialog).findByText(
        'Somente profissionais da equipe podem alterar a situação social.',
      ),
    ).toBeInTheDocument();
        expect(
      screen.getByRole('dialog', { name: 'Situação social' }),
    ).toBeInTheDocument();
    // O texto da página continua o antigo (o diálogo também mostra o texto).
    expect(
      within(
        screen.getByRole('complementary', { name: 'Sobre este plano' }),
      ).getByText(CURRENT_TEXT),
    ).toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão expira (401)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ message: 'unauthorised' }, 401),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alteração' }),
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('"Cancelar" fecha o diálogo sem chamar a API', async () => {
    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    expect(
      screen.queryByRole('dialog', { name: 'Situação social' }),
    ).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});