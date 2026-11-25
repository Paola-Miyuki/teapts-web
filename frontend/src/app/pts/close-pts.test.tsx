import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PtsDetailPage from './[ptsId]/PtsDetail';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const RESPONSIBLE: Account = {
  accountId: 'professional-uuid',
  name: 'Ana Souza',
  email: 'ana@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['prof-1'],
};
const MEMBER: Account = { ...RESPONSIBLE, professionalProfileIds: ['prof-2'] };
const ADMIN: Account = {
  ...RESPONSIBLE,
  role: 'admin',
  professionalProfileIds: [],
};
const PATIENT: Account = {
  ...RESPONSIBLE,
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};

const professional = (id: string, name: string) => ({
  id,
  name,
  specialism: { id: 'psychologist', name: 'Psicologia' },
  registration: null,
});

const PTS = {
  id: 'pts-1',
  status: 'running',
  createdAt: '2026-11-05T13:00:00.000Z',
  acceptedAt: '2026-11-10T13:00:00.000Z',
  rejectedAt: null,
  beganAt: '2026-11-12T13:00:00.000Z',
  concludedAt: null,
  cancelledAt: null,
  closingDate: null,
  closingReason: null,
  patient: { id: 'patient-1', name: 'Diego Alves' },
  responsible: professional('prof-1', 'Ana Souza'),
  team: [professional('prof-2', 'Beatriz Lopes')],
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

const CLOSED = {
  id: 'pts-1',
  status: 'cancelled',
  closingDate: '2026-12-10',
  closingReason: 'A família mudou de cidade.',
};

const callsTo = (part: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(([url]) => url.includes(part));

describe('Encerrar PTS (RFPTS010)', () => {
  const replace = jest.fn();

  async function open(
    account: Account,
    pts: object = {},
    close: () => Promise<Response> = async () => respond(200, CLOSED),
    readOnly = false,
  ) {
    global.fetch = jest.fn((url: string) =>
      url.endsWith('/close')
        ? close()
        : Promise.resolve(
            url.endsWith('/me')
              ? respond(200, account)
              : url.endsWith('/unread-count')
                ? respond(200, { unreadCount: 0 })
                : url.endsWith('/goals') || url.endsWith('/activities')
                  ? respond(200, { data: [] })
                  : respond(200, { ...PTS, ...pts }),
          ),
    ) as jest.Mock;

    render(<PtsDetailPage id="pts-1" readOnly={readOnly} />);
    await screen.findByRole('heading', { name: 'PTS de Diego Alves' });
  }

  const closeButton = () => screen.queryByRole('button', { name: 'Encerrar' });
  const dialog = () => within(screen.getByRole('dialog'));
  const submit = () =>
    fireEvent.click(dialog().getByRole('button', { name: 'Encerrar PTS' }));

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    window.history.replaceState(null, '', '/pts/pts-1');
  });

  it.each([
    ['responsável', 'planning', RESPONSIBLE],
    ['responsável', 'running', RESPONSIBLE],
    ['admin', 'running', ADMIN],
  ])('aparece em vermelho para o %s em %s', async (_name, status, account) => {
    await open(account, { status });

    expect(closeButton()).toHaveClass('btn-danger');
  });

  it.each([
    ['membro da equipe', MEMBER, {}],
    ['paciente', PATIENT, {}],
    ['proposta', RESPONSIBLE, { status: 'draft' }],
    ['PTS concluído', ADMIN, { status: 'concluded' }],
  ])('não aparece: %s', async (_name, account, pts) => {
    await open(account, pts);

    expect(closeButton()).not.toBeInTheDocument();
  });

  it('não aparece no modo somente leitura', async () => {
    await open(RESPONSIBLE, {}, undefined, true);

    expect(closeButton()).not.toBeInTheDocument();
  });

  it('exige a data', async () => {
    await open(RESPONSIBLE);
    fireEvent.click(closeButton()!);
    fireEvent.change(screen.getByLabelText(/^Data de encerramento/), {
      target: { value: '' },
    });
    submit();

    expect(
      screen.getByText('Informe a data de encerramento'),
    ).toBeInTheDocument();
    expect(callsTo('/close')).toHaveLength(0);
  });

  it('envia a opção, a data e o motivo e mostra o resultado no cartão', async () => {
    let finish: (value: Response) => void = () => undefined;
    await open(
      RESPONSIBLE,
      {},
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(closeButton()!);

    expect(
      dialog()
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Concluir: o plano foi cumprido',
      'Cancelar: o plano foi interrompido',
    ]);
    fireEvent.change(screen.getByLabelText(/^Como encerrar/), {
      target: { value: 'cancelled' },
    });
    fireEvent.change(screen.getByLabelText(/^Data de encerramento/), {
      target: { value: '2026-12-10' },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo do encerramento/), {
      target: { value: '  A família mudou de cidade.  ' },
    });
    submit();

    expect(
      screen.getByRole('button', { name: 'Encerrando...' }),
    ).toBeDisabled();
    const [url, init] = callsTo('/close')[0];
    expect(url).toBe('http://localhost:3000/pts/pts-1/close');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({
      outcome: 'cancelled',
      closingDate: '2026-12-10',
      reason: 'A família mudou de cidade.',
    });
    const activitiesBefore = callsTo('/activities').length;

    finish(respond(200, CLOSED));

    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByText('Encerrado em')).toBeInTheDocument();
    expect(screen.getByText('10/12/2026')).toBeInTheDocument();
    expect(screen.getByText('A família mudou de cidade.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closeButton()).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Registrar reavaliação' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(callsTo('/activities')).toHaveLength(activitiesBefore + 1),
    );
    expect(callsTo('/pts/pts-1')).not.toHaveLength(0);
  });

  it('sem motivo, não envia o campo', async () => {
    await open(RESPONSIBLE);
    fireEvent.click(closeButton()!);
    submit();

    await waitFor(() => expect(callsTo('/close')).toHaveLength(1));
    const body = JSON.parse(callsTo('/close')[0][1].body);
    expect(body).toEqual({
      outcome: 'concluded',
      closingDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('mostra a mensagem da API no modal', async () => {
    await open(RESPONSIBLE, {}, async () =>
      respond(409, { status: 'PTS_NOT_ACTIVE', message: 'PTS já encerrado.' }),
    );
    fireEvent.click(closeButton()!);
    submit();

    expect(await dialog().findByText('PTS já encerrado.')).toBeInTheDocument();
  });

  it('vai para o login sem sessão', async () => {
    await open(RESPONSIBLE, {}, async () => respond(401, {}));
    fireEvent.click(closeButton()!);
    submit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
