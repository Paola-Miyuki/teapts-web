import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

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
const MEMBER_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const DELETE_URL = `http://localhost:3000/pts/${PTS_ID}/team/${MEMBER_ID}`;

const RESPONSIBLE = {
  id: RESPONSIBLE_ID,
  name: 'Responsável Teste',
  specialism: { id: 'psychologist', name: 'Psicologia' },
};

const MEMBER = {
  id: MEMBER_ID,
  name: 'Integrante Teste',
  specialism: { id: 'doctor', name: 'Medicina' },
};

const REMOVE_MEMBER = 'Remover Integrante Teste da equipe';

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
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [professionalId],
  };
}

function patientAccount(): Account {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Paciente Teste',
    email: 'paciente@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: PATIENT_ID,
    professionalProfileIds: [],
  };
}

function activePts(overrides: Record<string, unknown> = {}) {
  return {
    id: PTS_ID,
    status: 'running',
    socialSituation: 'Situação social de teste.',
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: '2026-10-15T12:30:00.000Z',
    beganAt: null,
    patient: { id: PATIENT_ID, name: 'Paciente Teste' },
    responsible: RESPONSIBLE,
    team: [MEMBER],
    ...overrides,
  };
}

// Carrega o PTS ativo e abre o diálogo "Remover da equipe?".
async function openDialog() {
  render(
    <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
  );

  await userEvent.click(
    await screen.findByRole('button', { name: REMOVE_MEMBER }),
  );

  return screen.findByRole('dialog', { name: 'Remover da equipe?' });
}

describe('Remover profissional da equipe (RFEM003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts()),
    );
  });

  it('mostra "Remover" para o responsável, nunca no próprio responsável', async () => {
    render(
      <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
    );

    expect(
      await screen.findByRole('button', { name: REMOVE_MEMBER }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Remover Responsável Teste da equipe',
      }),
    ).not.toBeInTheDocument();
  });

  it('não mostra "Remover" para um membro da equipe', async () => {
    render(
      <PtsOverview
        account={professionalAccount(MEMBER_ID)}
        patientId={PATIENT_ID}
      />,
    );

    expect(await screen.findByText('Integrante Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Remover / }),
    ).not.toBeInTheDocument();
  });

  it('não mostra "Remover" para o paciente', async () => {
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts({ socialSituation: undefined })),
    );

    render(<PtsOverview account={patientAccount()} patientId={PATIENT_ID} />);

    expect(await screen.findByText('Integrante Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Remover / }),
    ).not.toBeInTheDocument();
  });

  it('pede confirmação explicando que os registros são mantidos', async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByText('Integrante Teste')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Os registros que ele já fez são mantidos/),
    ).toBeInTheDocument();
  });

  it('remove, mostra a equipe da resposta e o aviso', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({
        id: PTS_ID,
        status: 'RUNNING',
        responsible: RESPONSIBLE,
        team: [],
      }),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remover' }),
    );

    expect(
      await screen.findByText('Profissional removido da equipe.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Integrante Teste')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Ainda não há outros profissionais na equipe deste plano.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Remover da equipe?' }),
    ).not.toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(DELETE_URL, {
      method: 'DELETE',
      credentials: 'include',
    });
  });

  it('"Cancelar" fecha o diálogo sem chamar a API', async () => {
    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    expect(
      screen.queryByRole('dialog', { name: 'Remover da equipe?' }),
    ).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('mostra o loading no botão de confirmação', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remover' }),
    );

    expect(
      within(dialog).getByRole('button', { name: 'Removendo...' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('exibe a mensagem da API no diálogo (409)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        {
          status: 'CANNOT_REMOVE_RESPONSIBLE',
          message:
            'O responsável não pode ser removido da equipe. Transfira a responsabilidade antes.',
        },
        409,
      ),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remover' }),
    );

    expect(
      await within(dialog).findByText(
        'O responsável não pode ser removido da equipe. Transfira a responsabilidade antes.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Remover da equipe?' }),
    ).toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão expira (401)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ message: 'unauthorised' }, 401),
    );

    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remover' }),
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
