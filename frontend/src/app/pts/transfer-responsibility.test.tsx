'use client';

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PtsOverview from './_components/PtsOverview';

jest.mock('@/components/pts/TimelineTab', () => ({
  __esModule: true,
  default: () => null,
}));

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PTS_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const NEW_RESPONSIBLE_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const TRANSFER_URL = `http://localhost:3000/pts/${PTS_ID}/team/transfer-responsibility`;

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

const NEW_RESPONSIBLE = {
  id: NEW_RESPONSIBLE_ID,
  name: 'Novo Responsável',
  email: null,
  specialism: { id: 'doctor', name: 'Medicina' },
  registration: null,
  institution: null,
  cnes: null,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function professionalAccount(
  professionalProfileIds = [RESPONSIBLE_ID],
): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Profissional',
    email: 'profissional@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds,
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

function installFetch(
  transferStatus = 200,
  transferBody: unknown = {
    id: PTS_ID,
    status: 'RUNNING',
    responsible: NEW_RESPONSIBLE,
    team: [MEMBER],
  },
) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === '/pts/active') {
      return jsonResponse(activePts());
    }

    if (url.pathname === '/professionals') {
      return jsonResponse({ data: [RESPONSIBLE, NEW_RESPONSIBLE] });
    }

    if (
      url.pathname === `/pts/${PTS_ID}/team/transfer-responsibility` &&
      init?.method === 'POST'
    ) {
      return jsonResponse(transferBody, transferStatus);
    }

    return jsonResponse({}, 404);
  }) as jest.Mock;
}

async function openTransferModal(account = professionalAccount()) {
  render(<PtsOverview account={account} patientId={PATIENT_ID} />);

  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Transferir responsabilidade',
    }),
  );

  return screen.findByRole('dialog', {
    name: 'Transferir responsabilidade?',
  });
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = jest.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });
});

describe('Transferir responsabilidade (RFEM002)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installFetch();
  });

  it('mostra a ação somente ao profissional responsável', async () => {
    const { rerender } = render(
      <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
    );

    expect(
      await screen.findByRole('button', {
        name: 'Transferir responsabilidade',
      }),
    ).toBeInTheDocument();

    rerender(
      <PtsOverview
        account={professionalAccount([MEMBER_ID])}
        patientId={PATIENT_ID}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Transferir responsabilidade' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Remover Integrante Teste da equipe',
      }),
    ).not.toBeInTheDocument();
  });

  it('não mostra a ação para o paciente', async () => {
    render(<PtsOverview account={patientAccount()} patientId={PATIENT_ID} />);

    await screen.findByText('Integrante Teste');
    expect(
      screen.queryByRole('button', { name: 'Transferir responsabilidade' }),
    ).not.toBeInTheDocument();
  });

  it('busca candidatos e não lista o responsável atual', async () => {
    const dialog = await openTransferModal();

    expect(
      await within(dialog).findByRole('radio', {
        name: 'Novo Responsável Medicina',
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('radio', {
        name: 'Responsável Teste Psicologia',
      }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Transferir' }),
    ).toBeDisabled();
  });

  it('mostra loading enquanto busca profissionais', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname === '/pts/active') {
        return jsonResponse(activePts());
      }

      if (url.pathname === '/professionals') {
        return new Promise<Response>(() => {});
      }

      return jsonResponse({});
    }) as jest.Mock;

    const dialog = await openTransferModal();

    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Buscando profissionais...',
    );
  });

  it('debounceia a busca pelo nome', async () => {
    const dialog = await openTransferModal();

    fireEvent.change(
      within(dialog).getByRole('searchbox', {
        name: 'Buscar profissional por nome',
      }),
      { target: { value: 'Novo' } },
    );

    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(
        ([url]) => new URL(String(url)),
      );
      expect(
        urls.some(
          (url) =>
            url.pathname === '/professionals' &&
            url.searchParams.get('q') === 'Novo',
        ),
      ).toBe(true);
    });
  });

  it('transfere, atualiza a equipe, fecha o modal e oculta as ações do antigo responsável', async () => {
    const dialog = await openTransferModal();

    await userEvent.click(
      await within(dialog).findByRole('radio', {
        name: 'Novo Responsável Medicina',
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Transferir' }),
    );

    expect(
      await screen.findByText('Responsabilidade transferida.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Novo Responsável')).toBeInTheDocument();
    expect(screen.getByText('Integrante Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Transferir responsabilidade' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', {
        name: 'Transferir responsabilidade?',
      }),
    ).not.toBeInTheDocument();

    const transferCall = (global.fetch as jest.Mock).mock.calls.find(
      ([input, init]) =>
        String(input) === TRANSFER_URL && init?.method === 'POST',
    );
    expect(transferCall?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ newResponsibleId: NEW_RESPONSIBLE_ID }),
    });
  });

  it('destaca o substituto quando a API retorna TEAM_DUPLICATE_ACCOUNT', async () => {
    installFetch(400, {
      status: 'TEAM_DUPLICATE_ACCOUNT',
      message: 'A conta já está vinculada à equipe.',
      professionalIds: [NEW_RESPONSIBLE_ID],
    });

    const dialog = await openTransferModal();
    const candidate = await within(dialog).findByRole('radio', {
      name: 'Novo Responsável Medicina',
    });
    await userEvent.click(candidate);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Transferir' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A conta já está vinculada à equipe.',
    );
    expect(
      within(dialog).getByText('Conta já presente na equipe'),
    ).toBeInTheDocument();
    expect(candidate.closest('li')).toHaveClass('transferConflict');
  });

  it('redireciona para /login se a transferência retorna 401', async () => {
    installFetch(401, { message: 'Unauthorized' });

    const dialog = await openTransferModal();
    await userEvent.click(
      await within(dialog).findByRole('radio', {
        name: 'Novo Responsável Medicina',
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Transferir' }),
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('exibe mensagens de erro da API sem fechar o modal', async () => {
    installFetch(409, {
      status: 'PTS_NOT_ACTIVE',
      message: 'Somente PTS em andamento podem ser alterados.',
    });

    const dialog = await openTransferModal();
    await userEvent.click(
      await within(dialog).findByRole('radio', {
        name: 'Novo Responsável Medicina',
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Transferir' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Somente PTS em andamento podem ser alterados.',
    );
    expect(
      screen.getByRole('dialog', { name: 'Transferir responsabilidade?' }),
    ).toBeInTheDocument();
  });

  it('mostra loading no botão durante o envio e impede fechar o modal', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));

        if (url.pathname === '/pts/active') {
          return jsonResponse(activePts());
        }

        if (url.pathname === '/professionals') {
          return jsonResponse({ data: [NEW_RESPONSIBLE] });
        }

        if (init?.method === 'POST') {
          return new Promise(() => {});
        }

        return jsonResponse({});
      },
    );

    const dialog = await openTransferModal();
    await userEvent.click(
      await within(dialog).findByRole('radio', {
        name: 'Novo Responsável Medicina',
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Transferir' }),
    );

    expect(
      within(dialog).getByRole('button', { name: 'Transferindo...' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
  });
});
