import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/http';
import * as api from '../api/ptsApi';
import { CreatePts } from '../CreatePts';
import {
  MOCK_PATIENT_ID,
  MOCK_PATIENT_WITH_ACTIVE_PTS_ID,
  MOCK_PROFESSIONAL_ID,
  mockProfessionals,
} from '../api/mocks';
import type { Account } from '@/lib/account';

jest.mock('../api/ptsApi', () => ({
  listEligiblePatients: jest.fn(),
  listProfessionals: jest.fn(),
  createPts: jest.fn(),
}));

jest.mock('@/lib/supertokens', () => ({ initSuperTokens: jest.fn() }));

const SOCIAL = 'Paciente em situação de vulnerabilidade social.';

const testAccount: Account = {
  accountId: '00000000-0000-4000-8000-000000000001',
  name: 'Kaio Felipe',
  email: 'kaio@example.com',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: [MOCK_PROFESSIONAL_ID],
};

const createdPts = {
  id: '00000000-0000-4000-8000-000000000100',
  status: 'DRAFT' as const,
  socialSituation: SOCIAL,
  createdAt: '2026-10-06T18:00:00.000Z',
  patient: {
    id: MOCK_PATIENT_ID,
    name: 'Maria Silva',
  },
  responsible: {
    id: MOCK_PROFESSIONAL_ID,
    name: 'Kaio Felipe',
    specialism: { id: 'psychologist', name: 'Psicologia' },
  },
  team: mockProfessionals.slice(1, 3).map((professional) => ({
    id: professional.id,
    name: professional.name,
    specialism: professional.specialism,
  })),
};

async function renderScreen() {
  render(<CreatePts account={testAccount} />);
  await screen.findByLabelText(/^paciente$/i);
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  withTeam = true,
) {
  await user.selectOptions(
    screen.getByLabelText(/^paciente$/i),
    MOCK_PATIENT_ID,
  );

  if (withTeam) {
    await user.click(screen.getByText(/selecione os profissionais/i));
    await user.click(screen.getByLabelText(/Ana Lima/));
    await user.click(screen.getByLabelText(/Bruno Souza/));
  }

  await user.type(screen.getByLabelText(/situação social/i), SOCIAL);
}

beforeEach(() => {
  jest.resetAllMocks();

  (api.listEligiblePatients as jest.Mock).mockResolvedValue([
    { id: MOCK_PATIENT_ID, name: 'Maria Silva' },
    {
      id: MOCK_PATIENT_WITH_ACTIVE_PTS_ID,
      name: 'Diego Alves',
    },
  ]);

  (api.listProfessionals as jest.Mock).mockResolvedValue(mockProfessionals);
});

describe('CreatePts', () => {
  it('carrega os dados e não lista o próprio responsável na equipe', async () => {
    await renderScreen();

    expect(
      screen.getByRole('option', { name: 'Maria Silva' }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/Ana Lima/)).toBeInTheDocument();

    const teamCheckboxes = screen.getAllByRole('checkbox');

    expect(
      teamCheckboxes.some(
        (checkbox) => checkbox.getAttribute('value') === MOCK_PROFESSIONAL_ID,
      ),
    ).toBe(false);

    expect(screen.getByLabelText(/seu perfil profissional/i)).toHaveValue(
      `${mockProfessionals[0].name} · ${mockProfessionals[0].specialism.name}`,
    );
  });

  it('valida campos obrigatórios e não chama a API', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(screen.getByText('Selecione o paciente.')).toBeInTheDocument();
    expect(
      screen.getByText('Descreva a situação social do paciente.'),
    ).toBeInTheDocument();
    expect(api.createPts).not.toHaveBeenCalled();
  });

  it('cria com o payload correto, mostra loading e informa DRAFT', async () => {
    const user = userEvent.setup();
    let resolve!: (v: typeof createdPts) => void;
    (api.createPts as jest.Mock).mockReturnValue(
      new Promise((r) => (resolve = r)),
    );

    await renderScreen();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    const ana = mockProfessionals.find(
      (professional) => professional.name === 'Ana Lima',
    );

    const bruno = mockProfessionals.find(
      (professional) => professional.name === 'Bruno Souza',
    );

    expect(ana).toBeDefined();
    expect(bruno).toBeDefined();

    expect(api.createPts).toHaveBeenCalledWith({
      professionalId: MOCK_PROFESSIONAL_ID,
      patientId: MOCK_PATIENT_ID,
      socialSituation: SOCIAL,
      teamProfessionalIds: [ana!.id, bruno!.id],
    });

    resolve(createdPts);
    expect(await screen.findByTestId('pts-created')).toHaveTextContent(
      'A proposta para Maria Silva foi criada e aguarda a aprovação do paciente',
    );
    expect(
      screen.getByRole('link', { name: /ver propostas do paciente/i }),
    ).toHaveAttribute('href', `/pts/proposals?patientId=${MOCK_PATIENT_ID}`);
  });

  it('permite criar sem equipe (opcional)', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockResolvedValue({
      ...createdPts,
      team: [],
    });
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    await waitFor(() =>
      expect(api.createPts).toHaveBeenCalledWith(
        expect.objectContaining({ teamProfessionalIds: [] }),
      ),
    );
  });

  it('trata PTS_ACTIVE_EXISTS e destaca o campo paciente', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockRejectedValue(
      new ApiError(
        409,
        'PTS_ACTIVE_EXISTS',
        'O paciente já possui um PTS aprovado e ativo.',
      ),
    );
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(
      await screen.findByText('Este paciente já tem um PTS ativo'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^paciente$/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /criar proposta/i }),
    ).toBeEnabled();
  });

  it('trata profissional sem autorização para o perfil (403)', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockRejectedValue(
      new ApiError(403, 'PROFESSIONAL_NOT_AUTHORIZED'),
    );
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(
      await screen.findByText('Perfil sem autorização'),
    ).toBeInTheDocument();
  });

  it('exibe a mensagem da API em erros não mapeados e preserva o formulário', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockRejectedValue(
      new ApiError(500, 'INTERNAL', 'Falha interna.'),
    );
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(await screen.findByText('Falha interna.')).toBeInTheDocument();
    expect(screen.getByLabelText(/situação social/i)).toHaveValue(SOCIAL);
  });

  it('permite tentar de novo quando o carregamento inicial falha', async () => {
    const user = userEvent.setup();

    (api.listEligiblePatients as jest.Mock).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR'),
    );

    render(<CreatePts account={testAccount} />);

    await user.click(
      await screen.findByRole('button', { name: /tentar novamente/i }),
    );

    expect(await screen.findByLabelText(/^paciente$/i)).toBeInTheDocument();
  });
});
