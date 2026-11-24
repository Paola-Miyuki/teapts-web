import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import EditPtsSheetForm from './EditPtsSheetForm';

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: mockReplace, push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PTS_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const GET_URL = `http://localhost:3000/pts/${PTS_ID}`;
const PATCH_URL = `http://localhost:3000/pts/${PTS_ID}/sheet`;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Profissional',
    email: 'profissional@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [RESPONSIBLE_ID],
    ...overrides,
  };
}

function pts(overrides: Record<string, unknown> = {}) {
  return {
    id: PTS_ID,
    status: 'planning',
    socialSituation: 'Mora com a mãe.',
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum da equipe.',
    cid: 'F84.0',
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação funcional', 'Autonomia'],
    vulnerabilities: null,
    comorbidities: 'TDAH',
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: null,
    rejectedAt: null,
    beganAt: null,
    concludedAt: null,
    cancelledAt: null,
    patient: { id: PATIENT_ID, name: 'Priscila Martins' },
    responsible: {
      id: RESPONSIBLE_ID,
      name: 'Kaio Segunda Conta',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
    team: [
      {
        id: MEMBER_ID,
        name: 'Integrante Teste',
        specialism: { id: 'doctor', name: 'Medicina' },
        registration: null,
      },
    ],
    ...overrides,
  };
}

async function renderForm(
  currentAccount: Account = account(),
  loaded: Record<string, unknown> = pts(),
) {
  (global.fetch as jest.Mock).mockImplementationOnce(() =>
    jsonResponse(loaded),
  );

  render(<EditPtsSheetForm ptsId={PTS_ID} account={currentAccount} />);
}

const next = () =>
  userEvent.click(screen.getByRole('button', { name: /Próximo/ }));

// Preenche os 3 passos com a ficha carregada e chega ao botão "Salvar PTS".
async function goToLastStep() {
  await screen.findByLabelText(/^Síntese do diagnóstico/);
  await next();
  await screen.findByRole('heading', { name: 'Perfil e vulnerabilidades' });
  await next();
  await screen.findByRole('heading', { name: 'Prazo' });
}

describe('Editar PTS (RFPTS005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('carrega o PTS e preenche o passo Diagnóstico', async () => {
    await renderForm();

    expect(
      await screen.findByRole('heading', {
        name: 'Editar PTS de Priscila Martins',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Data do estudo de caso/)).toHaveValue(
      '2026-10-01',
    );
    expect(screen.getByLabelText('Nível de suporte')).toHaveValue('2');
    expect(screen.getByLabelText('CID')).toHaveValue('F84.0');
    expect(screen.getByLabelText(/^Síntese do diagnóstico/)).toHaveValue(
      'Diagnóstico em comum da equipe.',
    );
    expect(screen.getByText('Comunicação funcional')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      GET_URL,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('valida a síntese obrigatória e não avança', async () => {
    await renderForm();

    const summary = await screen.findByLabelText(/^Síntese do diagnóstico/);
    await userEvent.clear(summary);
    await userEvent.type(summary, '   ');
    await next();

    expect(
      screen.getByText('Descreva a síntese do diagnóstico'),
    ).toBeInTheDocument();
    expect(summary).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByRole('heading', { name: 'Diagnóstico' }),
    ).toBeInTheDocument();
  });

  it('valida a situação social no passo 2 e a revisão no passo 3', async () => {
    await renderForm();

    await screen.findByLabelText(/^Síntese do diagnóstico/);
    await next();

    const social = await screen.findByLabelText(/^Situação social/);
    await userEvent.clear(social);
    await next();
    expect(
      screen.getByText('Descreva a situação social do paciente'),
    ).toBeInTheDocument();

    await userEvent.type(social, 'Mora com a mãe.');
    await next();

    const review = await screen.findByLabelText(/^Próxima revisão/);
    await userEvent.clear(review);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar PTS' }));

    expect(screen.getByText('Informe a próxima revisão')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('adiciona, sobe e remove necessidades prioritárias', async () => {
    await renderForm();

    await screen.findByLabelText(/^Síntese do diagnóstico/);
    await userEvent.type(screen.getByLabelText('Nova necessidade'), 'Sono');
    await userEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Subir Sono' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Remover Autonomia' }),
    );

    const items = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items.join('|')).toMatch(
      /Comunicação funcional.*Sono|Sono.*Comunicação funcional/,
    );
    expect(screen.queryByText('Autonomia')).not.toBeInTheDocument();
  });

  it('salva a ficha nos 3 passos e volta para o PTS', async () => {
    await renderForm();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ id: PTS_ID }),
    );

    await goToLastStep();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar PTS' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/pts/${PTS_ID}`);
    });

    expect(global.fetch).toHaveBeenLastCalledWith(PATCH_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseStudyDate: '2026-10-01',
        diagnosisSummary: 'Diagnóstico em comum da equipe.',
        cid: 'F84.0',
        supportLevel: 2,
        strengths: null,
        priorityNeeds: ['Comunicação funcional', 'Autonomia'],
        socialSituation: 'Mora com a mãe.',
        vulnerabilities: null,
        comorbidities: 'TDAH',
        sensoryProfile: null,
        communicationMethod: null,
        nextReviewAt: '2027-10-01',
      }),
      credentials: 'include',
    });
  });

  it('mostra o loading e bloqueia o envio duplicado', async () => {
    await renderForm();
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    await goToLastStep();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar PTS' }));

    const saving = await screen.findByRole('button', { name: 'Salvando...' });

    expect(saving).toBeDisabled();
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      403,
      'FORBIDDEN',
      'Somente a equipe do PTS e o administrador podem alterar a ficha.',
    ],
    [
      409,
      'PTS_NOT_ACTIVE',
      'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
    ],
  ])('exibe a mensagem da API no erro %i', async (status, code, message) => {
    await renderForm();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ status: code, message }, status as number),
    );

    await goToLastStep();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar PTS' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redireciona para o login quando a sessão expira ao salvar (401)', async () => {
    await renderForm();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ message: 'unauthorised' }, 401),
    );

    await goToLastStep();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar PTS' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('o admin pode editar', async () => {
    await renderForm(account({ role: 'admin', professionalProfileIds: [] }));

    expect(
      await screen.findByLabelText(/^Síntese do diagnóstico/),
    ).toBeInTheDocument();
  });

  it('o paciente não edita', async () => {
    await renderForm(
      account({ professionalProfileIds: [], patientProfileId: PATIENT_ID }),
    );

    expect(
      await screen.findByText(
        'Somente a equipe do PTS e o administrador podem editar a ficha',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Síntese do diagnóstico/),
    ).not.toBeInTheDocument();
  });

  it('não edita profissional fora da equipe nem PTS que não está ativo', async () => {
    await renderForm(account({ professionalProfileIds: ['outro-id'] }));

    expect(
      await screen.findByText(
        'Somente a equipe do PTS e o administrador podem editar a ficha',
      ),
    ).toBeInTheDocument();
  });

  it('avisa quando o PTS não está em planejamento ou execução', async () => {
    await renderForm(account(), pts({ status: 'concluded' }));

    expect(
      await screen.findByText(
        'Somente o PTS em planejamento ou execução pode ser editado',
      ),
    ).toBeInTheDocument();
  });

  it('mostra a mensagem da API ao carregar (404) e permite tentar de novo', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        { status: 'PTS_NOT_FOUND', message: 'PTS não encontrado.' },
        404,
      ),
    );
    render(<EditPtsSheetForm ptsId={PTS_ID} account={account()} />);

    expect(await screen.findByText('PTS não encontrado.')).toBeInTheDocument();

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(pts()),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByLabelText(/^Síntese do diagnóstico/),
    ).toBeInTheDocument();
  });
});
