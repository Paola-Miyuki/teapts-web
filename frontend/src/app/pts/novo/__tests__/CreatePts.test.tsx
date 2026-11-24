import { render, screen, waitFor, within } from '@testing-library/react';
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
import { personalData } from '@/test-utils/account';

jest.mock('../api/ptsApi', () => ({
  listEligiblePatients: jest.fn(),
  listProfessionals: jest.fn(),
  createPts: jest.fn(),
}));

jest.mock('@/lib/supertokens', () => ({ initSuperTokens: jest.fn() }));

// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const SOCIAL = 'Paciente em situação de vulnerabilidade social.';

const testAccount: Account = {
  accountId: '00000000-0000-4000-8000-000000000001',
  name: 'Kaio Felipe',
  email: 'kaio@example.com',
  role: 'user',
  ...personalData,
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

async function renderScreen(account: Account = testAccount) {
  render(<CreatePts account={account} />);
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: /Paciente/ })).toBeEnabled(),
  );
}

type User = ReturnType<typeof userEvent.setup>;

async function choosePatient(user: User, name = 'Maria Silva') {
  await user.type(screen.getByRole('combobox', { name: /Paciente/ }), 'ma');
  await user.click(
    await screen.findByRole('option', { name: new RegExp(`^${name}`) }),
  );
}

async function next(user: User) {
  await user.click(screen.getByRole('button', { name: /Próximo/ }));
}

async function addMember(user: User, name: string) {
  await user.click(screen.getByRole('combobox', { name: 'Adicionar membro' }));
  await user.click(
    await screen.findByRole('option', { name: new RegExp(`^${name}`) }),
  );
}

// Passa pelos passos 1 e 2 e para no passo de equipe.
async function fillUntilTeam(user: User) {
  await choosePatient(user);
  await next(user);
  await user.type(
    screen.getByRole('textbox', { name: /^Situação social/ }),
    SOCIAL,
  );
  await next(user);
}

beforeEach(() => {
  jest.resetAllMocks();

  (api.listEligiblePatients as jest.Mock).mockResolvedValue([
    { id: MOCK_PATIENT_ID, name: 'Maria Silva', email: 'maria@exemplo.com' },
    {
      id: MOCK_PATIENT_WITH_ACTIVE_PTS_ID,
      name: 'Diego Alves',
      email: 'diego@exemplo.com',
    },
  ]);

  (api.listProfessionals as jest.Mock).mockResolvedValue(mockProfessionals);
});

describe('CreatePts', () => {
  it('mostra os passos e o profissional como responsável', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(
      screen.getByRole('list', { name: 'Passo 1 de 3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Paciente', level: 2 }),
    ).toBeInTheDocument();

    await fillUntilTeam(user);

    expect(
      screen.getByRole('list', { name: 'Passo 3 de 3' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Profissional responsável')).toHaveValue(
      `${mockProfessionals[0].name} · ${mockProfessionals[0].specialism.name}`,
    );

    // O responsável não aparece entre os membros.
    await user.click(
      screen.getByRole('combobox', { name: 'Adicionar membro' }),
    );
    expect(
      within(
        screen.getByRole('listbox', { name: 'Profissionais' }),
      ).getAllByRole('option'),
    ).toHaveLength(mockProfessionals.length - 1);
  });

  it('busca os pacientes elegíveis no servidor só a partir de 2 caracteres', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(api.listEligiblePatients).not.toHaveBeenCalled();

    (api.listEligiblePatients as jest.Mock).mockResolvedValueOnce([
      { id: 'patient-x', name: 'Mariana Costa', email: 'mariana@exemplo.com' },
    ]);

    await user.type(screen.getByRole('combobox', { name: /Paciente/ }), 'mari');

    expect(
      await screen.findByRole('option', {
        name: 'Mariana Costa · mariana@exemplo.com',
      }),
    ).toBeInTheDocument();
    expect(api.listEligiblePatients).toHaveBeenLastCalledWith({
      q: 'mari',
      signal: expect.any(AbortSignal),
    });
  });

  it('não avança sem paciente nem sem situação social', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await next(user);
    expect(screen.getByText('Selecione o paciente')).toBeInTheDocument();

    await choosePatient(user);
    await next(user);
    await next(user);
    expect(
      screen.getByText('Descreva a situação social do paciente'),
    ).toBeInTheDocument();
    expect(api.createPts).not.toHaveBeenCalled();
  });

  it('cria com o payload correto e informa que aguarda o paciente', async () => {
    const user = userEvent.setup();
    let resolve!: (v: typeof createdPts) => void;
    (api.createPts as jest.Mock).mockReturnValue(
      new Promise((r) => (resolve = r)),
    );

    await renderScreen();
    await fillUntilTeam(user);
    expect(
      screen.getByText('Nenhum membro além do responsável.'),
    ).toBeInTheDocument();
    await addMember(user, 'Ana Lima');
    await addMember(user, 'Bruno Souza');

    expect(
      screen.getByRole('button', { name: 'Remover Ana Lima da equipe' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    const ana = mockProfessionals.find((p) => p.name === 'Ana Lima')!;
    const bruno = mockProfessionals.find((p) => p.name === 'Bruno Souza')!;

    expect(
      screen.getByRole('button', { name: 'Criando proposta...' }),
    ).toBeDisabled();
    expect(api.createPts).toHaveBeenCalledWith({
      professionalId: MOCK_PROFESSIONAL_ID,
      patientId: MOCK_PATIENT_ID,
      socialSituation: SOCIAL,
      teamProfessionalIds: [ana.id, bruno.id],
    });

    resolve(createdPts);
    expect(await screen.findByTestId('pts-created')).toHaveTextContent(
      'A proposta para Maria Silva foi criada e aguarda a aprovação do paciente',
    );
    expect(screen.getByRole('link', { name: 'Ver propostas' })).toHaveAttribute(
      'href',
      '/pts/proposals',
    );
  });

  it('permite criar sem equipe (opcional)', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockResolvedValue({ ...createdPts, team: [] });
    await renderScreen();
    await fillUntilTeam(user);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    await waitFor(() =>
      expect(api.createPts).toHaveBeenCalledWith(
        expect.objectContaining({ teamProfessionalIds: [] }),
      ),
    );
  });

  it('trata PTS_ACTIVE_EXISTS e volta ao passo do paciente', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockRejectedValue(
      new ApiError(
        409,
        'PTS_ACTIVE_EXISTS',
        'O paciente já possui um PTS aprovado e ativo.',
      ),
    );
    await renderScreen();
    await fillUntilTeam(user);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(
      await screen.findByText('Este paciente já tem um PTS ativo'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Paciente/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('trata profissional sem autorização para o perfil (403)', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockRejectedValue(
      new ApiError(403, 'PROFESSIONAL_NOT_AUTHORIZED'),
    );
    await renderScreen();
    await fillUntilTeam(user);
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
    await fillUntilTeam(user);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(await screen.findByText('Falha interna.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(
      screen.getByRole('textbox', { name: /^Situação social/ }),
    ).toHaveValue(SOCIAL);
  });

  it('permite tentar de novo quando o carregamento inicial falha', async () => {
    const user = userEvent.setup();

    (api.listProfessionals as jest.Mock).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR'),
    );

    render(<CreatePts account={testAccount} />);

    await user.click(
      await screen.findByRole('button', { name: /tentar novamente/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Paciente/ })).toBeEnabled(),
    );
  });
});

describe('CreatePts com administrador (RN022)', () => {
  const adminAccount: Account = {
    accountId: '00000000-0000-4000-8000-0000000000aa',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [],
  };

  it('escolhe o profissional responsável entre todos e envia o professionalId', async () => {
    const user = userEvent.setup();
    (api.createPts as jest.Mock).mockResolvedValue(createdPts);

    await renderScreen(adminAccount);
    expect(
      screen.queryByText(/sem perfil profissional/i),
    ).not.toBeInTheDocument();

    await fillUntilTeam(user);

    const select = screen.getByLabelText('Profissional responsável');
    expect(within(select).getAllByRole('option')).toHaveLength(
      mockProfessionals.length + 1,
    );

    await user.click(screen.getByRole('button', { name: /criar proposta/i }));
    expect(
      screen.getByText('Selecione o profissional responsável'),
    ).toBeInTheDocument();
    expect(api.createPts).not.toHaveBeenCalled();

    await user.selectOptions(select, mockProfessionals[1].id);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    await waitFor(() =>
      expect(api.createPts).toHaveBeenCalledWith({
        professionalId: mockProfessionals[1].id,
        patientId: MOCK_PATIENT_ID,
        socialSituation: SOCIAL,
        teamProfessionalIds: [],
      }),
    );
  });
});
