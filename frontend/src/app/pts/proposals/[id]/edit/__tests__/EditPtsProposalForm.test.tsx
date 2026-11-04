import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Account } from '@/lib/account';

import EditPtsProposalForm from '../EditPtsProposalForm';

import {
  getProfessionalsForTeam,
  getPtsProposal,
  PtsProposalApiError,
  updatePtsProposal,
} from '../api';

jest.mock('@/lib/supertokens', () => ({
  initSuperTokens: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();

const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  refresh: mockRefresh,
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../api', () => {
  const actual = jest.requireActual('../api');

  return {
    ...actual,
    getPtsProposal: jest.fn(),
    getProfessionalsForTeam: jest.fn(),
    updatePtsProposal: jest.fn(),
  };
});

const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';

const TEAM_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

const OTHER_ID = '4d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1b';

const PROPOSAL_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';

const account: Account = {
  accountId: '11111111-1111-4111-8111-111111111111',
  name: 'Profissional Teste',
  email: 'profissional@example.com',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: [RESPONSIBLE_ID],
};

const proposal = {
  id: PROPOSAL_ID,

  status: 'DRAFT',

  socialSituation: 'Mora com a mãe.',

  createdAt: '2026-10-15T12:00:00.000Z',

  patient: {
    id: PATIENT_ID,
    name: 'Paciente Teste',
  },

  responsible: {
    id: RESPONSIBLE_ID,
    name: 'Responsável Teste',

    specialism: {
      id: 'psychologist',
      name: 'Psicologia',
    },
  },

  team: [
    {
      id: TEAM_ID,
      name: 'Médico Teste',

      specialism: {
        id: 'doctor',
        name: 'Medicina',
      },
    },
  ],
};

const professionals = [
  {
    id: RESPONSIBLE_ID,
    name: 'Responsável Teste',
    email: 'responsavel@example.com',

    specialism: {
      id: 'psychologist',
      name: 'Psicologia',
    },
  },

  {
    id: TEAM_ID,
    name: 'Médico Teste',
    email: 'medico@example.com',

    specialism: {
      id: 'doctor',
      name: 'Medicina',
    },
  },

  {
    id: OTHER_ID,
    name: 'Fisioterapeuta Teste',
    email: 'fisio@example.com',

    specialism: {
      id: 'physiotherapist',
      name: 'Fisioterapia',
    },
  },
];

describe('EditPtsProposalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getPtsProposal as jest.Mock).mockResolvedValue(proposal);

    (getProfessionalsForTeam as jest.Mock).mockResolvedValue(professionals);
  });

  it('carrega a proposta e não oferece o responsável como integrante da equipe', async () => {
    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    expect(
      await screen.findByDisplayValue('Paciente Teste'),
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue('Responsável Teste · Psicologia'),
    ).toBeInTheDocument();

    expect(screen.getByDisplayValue('Mora com a mãe.')).toBeInTheDocument();

    expect(
      screen.queryByLabelText('Responsável Teste · Psicologia'),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByLabelText('Médico Teste · Medicina'),
    ).toBeChecked();
  });

  it('atualiza situação social e equipe e volta para as propostas', async () => {
    (updatePtsProposal as jest.Mock).mockResolvedValue({
      ...proposal,

      socialSituation: 'Nova situação social.',

      team: [
        proposal.team[0],

        {
          id: OTHER_ID,
          name: 'Fisioterapeuta Teste',

          specialism: {
            id: 'physiotherapist',
            name: 'Fisioterapia',
          },
        },
      ],
    });

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    const textarea = await screen.findByLabelText('Situação social');

    const physiotherapist = await screen.findByLabelText(
      'Fisioterapeuta Teste · Fisioterapia',
    );

    const saveButton = await screen.findByRole('button', {
      name: 'Salvar proposta',
    });

    fireEvent.change(textarea, {
      target: {
        value: 'Nova situação social.',
      },
    });

    fireEvent.click(physiotherapist);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updatePtsProposal).toHaveBeenCalledWith(PROPOSAL_ID, {
        socialSituation: 'Nova situação social.',

        teamProfessionalIds: [TEAM_ID, OTHER_ID],
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        `/pts/proposals?patientId=${PATIENT_ID}&updated=1`,
      );
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('valida situação social vazia', async () => {
    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    const textarea = await screen.findByLabelText('Situação social');

    const saveButton = await screen.findByRole('button', {
      name: 'Salvar proposta',
    });

    fireEvent.change(textarea, {
      target: {
        value: '   ',
      },
    });

    fireEvent.click(saveButton);

    expect(
      await screen.findByText('Descreva a situação social do paciente.'),
    ).toBeInTheDocument();

    expect(updatePtsProposal).not.toHaveBeenCalled();
  });

  it('exibe a mensagem da API quando a proposta já foi decidida', async () => {
    (updatePtsProposal as jest.Mock).mockRejectedValue(
      new PtsProposalApiError(
        409,
        'Somente propostas aguardando decisão podem ser editadas.',
        'PTS_NOT_DRAFT',
      ),
    );

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    await screen.findByDisplayValue('Paciente Teste');

    const saveButton = await screen.findByRole('button', {
      name: 'Salvar proposta',
    });

    fireEvent.click(saveButton);

    expect(
      await screen.findByText(
        'Somente propostas aguardando decisão podem ser editadas.',
      ),
    ).toBeInTheDocument();
  });

  it('redireciona para login ao receber 401 no carregamento', async () => {
    (getPtsProposal as jest.Mock).mockRejectedValue(
      new PtsProposalApiError(401, 'Não autorizado.'),
    );

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('impede edição quando a conta não é responsável pela proposta', async () => {
    const otherAccount: Account = {
      ...account,

      professionalProfileIds: [OTHER_ID],
    };

    render(
      <EditPtsProposalForm proposalId={PROPOSAL_ID} account={otherAccount} />,
    );

    expect(
      await screen.findByText(
        'Somente o profissional responsável pode editar esta proposta.',
      ),
    ).toBeInTheDocument();
  });
});
