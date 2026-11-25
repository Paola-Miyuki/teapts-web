import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { getActivities } from '@/lib/activities';
import { getGoals, type Goal } from '@/lib/goals';
import { getPts } from '@/lib/pts';
import { personalData } from '@/test-utils/account';

import EditPtsProposalForm from '../EditPtsProposalForm';
import {
  getProfessionalsForTeam,
  PtsProposalApiError,
  updatePtsProposal,
} from '../api';

jest.mock('@/lib/supertokens', () => ({
  initSuperTokens: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  getProfessionalsForTeam: jest.fn(),
  updatePtsProposal: jest.fn(),
}));
jest.mock('@/lib/pts', () => ({
  ...jest.requireActual('@/lib/pts'),
  getPts: jest.fn(),
}));
jest.mock('@/lib/goals', () => ({
  ...jest.requireActual('@/lib/goals'),
  getGoals: jest.fn(),
}));
jest.mock('@/lib/activities', () => ({
  ...jest.requireActual('@/lib/activities'),
  getActivities: jest.fn(),
}));

const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const TEAM_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const OTHER_ID = '4d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1b';
const PROPOSAL_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';

const account: Account = {
  accountId: '11111111-1111-4111-8111-111111111111',
  name: 'Profissional Teste',
  email: 'profissional@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: [RESPONSIBLE_ID],
};

const professional = (id: string, name: string, specialism: string) => ({
  id,
  name,
  email: `${id}@example.com`,
  specialism: { id: specialism, name: specialism },
  registration: null,
});

const proposal = {
  id: PROPOSAL_ID,
  status: 'draft',
  version: 2,
  previousPts: { id: 'pts-1', version: 1 },
  caseStudyDate: '2026-12-15',
  diagnosisSummary: 'Síntese anterior',
  cid: 'F84.0',
  supportLevel: 2,
  strengths: 'Música',
  priorityNeeds: ['Comunicação'],
  socialSituation: 'Mora com a mãe.',
  vulnerabilities: null,
  comorbidities: 'TDAH',
  sensoryProfile: null,
  communicationMethod: null,
  nextReviewAt: '2027-12-15',
  createdAt: '2026-12-15T12:00:00.000Z',
  patient: { id: 'patient-1', name: 'Paciente Teste' },
  responsible: professional(RESPONSIBLE_ID, 'Responsável Teste', 'Psicologia'),
  team: [professional(TEAM_ID, 'Médico Teste', 'Medicina')],
};

const professionals = [
  professional(RESPONSIBLE_ID, 'Responsável Teste', 'Psicologia'),
  professional(TEAM_ID, 'Médico Teste', 'Medicina'),
  professional(OTHER_ID, 'Fisioterapeuta Teste', 'Fisioterapia'),
];

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  title: 'Esperar a vez',
  description: 'Esperar a vez em grupos.',
  term: 'short',
  area: 'social',
  measureCriterion: '8 de 10 rodadas',
  targetDate: '2027-02-01',
  status: 'in_progress',
  resultNote: null,
  origin: 'new',
  activitiesCount: 0,
  registeredBy: { id: 'p', name: 'Ana' },
  createdAt: '2026-12-15T12:00:00.000Z',
  ...overrides,
});

const ACTIVITY = {
  id: 'act-1',
  title: 'Integração sensorial',
  type: 'individual_session',
  frequency: { quantity: 1, period: 'weekly', durationMinutes: 45 },
  executor: 'team',
};

function setGoals(...goals: Goal[]) {
  (getGoals as jest.Mock).mockResolvedValue({ data: goals });
}

describe('EditPtsProposalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPts as jest.Mock).mockResolvedValue(proposal);
    (getProfessionalsForTeam as jest.Mock).mockResolvedValue(professionals);
    (getActivities as jest.Mock).mockResolvedValue({ data: [ACTIVITY] });
    setGoals(goal());
  });

  async function open(current: Account = account) {
    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={current} />);
    await screen.findByText('Paciente Teste');
  }

  const next = () =>
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));

  async function goTo(step: number) {
    for (let current = 1; current < step; current += 1) {
      next();
    }
    expect(
      await screen.findByRole('list', { name: `Passo ${step} de 4` }),
    ).toBeInTheDocument();
  }

  it('abre os 4 passos preenchidos', async () => {
    await open();

    expect(
      screen.getByRole('heading', { name: 'PTS v2 de Paciente Teste' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Data do novo estudo de caso/)).toHaveValue(
      '2026-12-15',
    );

    next();
    expect(screen.getByLabelText(/^Síntese do diagnóstico/)).toHaveValue(
      'Síntese anterior',
    );
    expect(screen.getByLabelText('CID')).toHaveValue('F84.0');
    expect(screen.getByText('Comunicação')).toBeInTheDocument();
    expect(screen.getByLabelText('Comorbidades')).toHaveValue('TDAH');
    expect(screen.getByLabelText(/^Situação social/)).toHaveValue(
      'Mora com a mãe.',
    );

    next();
    expect(
      screen.getByRole('listitem', { name: 'Esperar a vez' }),
    ).toBeInTheDocument();

    next();
    expect(
      screen.getByDisplayValue('Responsável Teste · Psicologia'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remover Médico Teste da equipe' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Data máxima/)).toHaveValue('2027-12-15');
    expect(await screen.findByText('Integração sensorial')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Atividades copiadas' }),
    ).toBeInTheDocument();
  });

  it('a primeira proposta continua "Editar proposta de PTS", sem cópias', async () => {
    (getPts as jest.Mock).mockResolvedValue({
      ...proposal,
      version: 1,
      previousPts: null,
    });
    await open();

    expect(
      screen.getByRole('heading', { name: 'Editar proposta de PTS' }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/^Data do estudo de caso/),
    ).toBeInTheDocument();
    await goTo(4);
    expect(
      screen.queryByRole('heading', { name: 'Atividades copiadas' }),
    ).not.toBeInTheDocument();
  });

  it('mostra a origem e os avisos das metas copiadas e não deixa avançar', async () => {
    setGoals(
      goal({
        id: 'g-1',
        title: 'Parcial',
        origin: 'kept_partial',
        term: null,
        targetDate: null,
      }),
      goal({
        id: 'g-2',
        title: 'Não atingida',
        origin: 'kept_not_achieved',
        targetDate: null,
      }),
    );
    await open();
    await goTo(3);

    const partial = within(screen.getByRole('listitem', { name: 'Parcial' }));
    expect(partial.getByText('v1 · parcial')).toBeInTheDocument();
    expect(partial.getByText('Defina o prazo')).toBeInTheDocument();
    expect(partial.getByText('Defina a data-alvo')).toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: 'Não atingida' })).getByText(
        'v1 · não atingida',
      ),
    ).toBeInTheDocument();

    next();
    expect(
      screen.getByText(
        'Defina o prazo e a data-alvo de todas as metas (faltam 2)',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Passo 3 de 4' }),
    ).toBeInTheDocument();
  });

  it('inclui, edita e remove metas pelo passo 3', async () => {
    await open();
    await goTo(3);

    fireEvent.click(screen.getByRole('button', { name: /Incluir meta/ }));
    expect(
      screen.getByRole('dialog', { name: 'Adicionar meta' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(
      screen.getByRole('dialog', { name: 'Editar meta' }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(
      screen.getByRole('dialog', { name: 'Excluir a meta?' }),
    ).toBeInTheDocument();
  });

  it('salva a ficha, a data máxima (por atalho) e a equipe', async () => {
    const user = userEvent.setup();
    (updatePtsProposal as jest.Mock).mockResolvedValue(undefined);
    await open();

    next();
    fireEvent.change(screen.getByLabelText(/^Síntese do diagnóstico/), {
      target: { value: '  Nova síntese  ' },
    });
    next();
    next();
    await user.click(screen.getByRole('button', { name: '6 meses' }));
    expect(screen.getByLabelText(/^Data máxima/)).toHaveValue('2027-06-15');

    await user.click(
      screen.getByRole('combobox', { name: 'Adicionar membro' }),
    );
    // O responsável não é oferecido como membro.
    expect(
      screen.queryByRole('option', { name: 'Responsável Teste · Psicologia' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('option', {
        name: 'Fisioterapeuta Teste · Fisioterapia',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar proposta' }));

    await waitFor(() => {
      expect(updatePtsProposal).toHaveBeenCalledWith(PROPOSAL_ID, {
        caseStudyDate: '2026-12-15',
        diagnosisSummary: 'Nova síntese',
        cid: 'F84.0',
        supportLevel: 2,
        strengths: 'Música',
        priorityNeeds: ['Comunicação'],
        socialSituation: 'Mora com a mãe.',
        vulnerabilities: null,
        comorbidities: 'TDAH',
        sensoryProfile: null,
        communicationMethod: null,
        nextReviewAt: '2027-06-15',
        teamProfessionalIds: [TEAM_ID, OTHER_ID],
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/pts/proposals?updated=1');
  });

  it.each([
    [1, /^Data do novo estudo de caso/, 'Informe a data do estudo de caso'],
    [2, /^Síntese do diagnóstico/, 'Descreva a síntese do diagnóstico'],
    [2, /^Situação social/, 'Descreva a situação social do paciente'],
    [4, /^Data máxima/, 'Informe a próxima revisão'],
  ])('no passo %s, exige %s', async (step, label, message) => {
    await open();
    await goTo(step);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
    fireEvent.click(
      screen.getByRole('button', { name: /Próximo|Salvar proposta/ }),
    );

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(updatePtsProposal).not.toHaveBeenCalled();
  });

  it('exibe a mensagem da API quando a proposta já foi decidida', async () => {
    (updatePtsProposal as jest.Mock).mockRejectedValue(
      new PtsProposalApiError(
        409,
        'Somente propostas aguardando decisão podem ser editadas',
        'PTS_NOT_DRAFT',
      ),
    );
    await open();
    await goTo(4);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar proposta' }));

    expect(
      await screen.findByText(
        'Somente propostas aguardando decisão podem ser editadas',
      ),
    ).toBeInTheDocument();
  });

  it('redireciona para login ao receber 401 no carregamento', async () => {
    (getPts as jest.Mock).mockRejectedValue(new ApiError(401));

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it.each([
    [
      'quem não é o responsável',
      { ...account, professionalProfileIds: [OTHER_ID] },
      proposal,
      'Somente o profissional responsável pode editar esta proposta',
    ],
    [
      'PTS que não é proposta',
      account,
      { ...proposal, status: 'running' },
      'Somente propostas aguardando decisão podem ser editadas',
    ],
  ])('não abre para %s', async (_name, current, loaded, message) => {
    (getPts as jest.Mock).mockResolvedValue(loaded);

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={current} />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
