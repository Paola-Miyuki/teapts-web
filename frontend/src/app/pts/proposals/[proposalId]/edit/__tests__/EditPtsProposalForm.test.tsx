import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';

import EditPtsProposalForm from '../EditPtsProposalForm';

import {
  getProfessionalsForTeam,
  getPtsProposal,
  PtsProposalApiError,
  updatePtsProposal,
} from '../api';
import { personalData } from '@/test-utils/account';

jest.mock('@/lib/supertokens', () => ({
  initSuperTokens: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();

const mockRouter = {
  push: mockPush,
  replace: mockReplace,
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
  ...personalData,
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

  it('mostra o paciente, a situação social e a equipe atual nos passos', async () => {
    const user = userEvent.setup();
    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Passo 1 de 3' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(
      screen.getByRole('textbox', { name: /^Situação social/ }),
    ).toHaveValue('Mora com a mãe.');

    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(
      screen.getByDisplayValue('Responsável Teste · Psicologia'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remover Médico Teste da equipe' }),
    ).toBeInTheDocument();

    // O responsável não é oferecido como membro.
    await user.click(
      screen.getByRole('combobox', { name: 'Adicionar membro' }),
    );
    expect(
      screen.queryByRole('option', { name: 'Responsável Teste · Psicologia' }),
    ).not.toBeInTheDocument();
  });

  it('atualiza situação social e equipe e volta para as propostas', async () => {
    const user = userEvent.setup();
    (updatePtsProposal as jest.Mock).mockResolvedValue(proposal);

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    await user.click(await screen.findByRole('button', { name: /Próximo/ }));
    const textarea = screen.getByRole('textbox', { name: /^Situação social/ });
    await user.clear(textarea);
    await user.type(textarea, 'Nova situação social.');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    await user.click(
      screen.getByRole('combobox', { name: 'Adicionar membro' }),
    );
    await user.click(
      screen.getByRole('option', {
        name: 'Fisioterapeuta Teste · Fisioterapia',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar proposta' }));

    await waitFor(() => {
      expect(updatePtsProposal).toHaveBeenCalledWith(PROPOSAL_ID, {
        socialSituation: 'Nova situação social.',
        teamProfessionalIds: [TEAM_ID, OTHER_ID],
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/pts/proposals?updated=1');
  });

  it('valida situação social vazia', async () => {
    const user = userEvent.setup();
    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    await user.click(await screen.findByRole('button', { name: /Próximo/ }));
    await user.clear(screen.getByRole('textbox', { name: /^Situação social/ }));
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    expect(
      await screen.findByText('Descreva a situação social do paciente'),
    ).toBeInTheDocument();
    expect(updatePtsProposal).not.toHaveBeenCalled();
  });

  it('exibe a mensagem da API quando a proposta já foi decidida', async () => {
    const user = userEvent.setup();
    (updatePtsProposal as jest.Mock).mockRejectedValue(
      new PtsProposalApiError(
        409,
        'Somente propostas aguardando decisão podem ser editadas',
        'PTS_NOT_DRAFT',
      ),
    );

    render(<EditPtsProposalForm proposalId={PROPOSAL_ID} account={account} />);

    await user.click(await screen.findByRole('button', { name: /Próximo/ }));
    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar proposta' }));

    expect(
      await screen.findByText(
        'Somente propostas aguardando decisão podem ser editadas',
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
        'Somente o profissional responsável pode editar esta proposta',
      ),
    ).toBeInTheDocument();
  });
});
