'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PtsTeamList } from './pts/_components/PtsTeamList';
import { PtsData } from './pts/_components/AddTeamMembersModal';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

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

const mockPts: PtsData = {
  id: 'pts-1',
  status: 'PLANNING',
  responsible: {
    id: 'prof-resp',
    name: 'Dra. Ana Responsável',
    specialism: { id: 'psychologist', name: 'Psicologia' },
  },
  team: [
    {
      id: 'prof-existing',
      name: 'Dr. Carlos Existente',
      specialism: { id: 'nurse', name: 'Enfermagem' },
    },
  ],
};

const candidateA = {
  id: 'prof-new-a',
  name: 'Dr. Kaio Felipe',
  specialism: { id: 'doctor', name: 'Medicina' },
};

const candidateB = {
  id: 'prof-new-b',
  name: 'Dra. Mariana Silva',
  specialism: { id: 'social_worker', name: 'Serviço Social' },
};

describe('RFEM001 - PtsTeamList e AddTeamMembersModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('exibe botão "Adicionar profissional" para o responsável e para admin (RN022)', () => {
    const { rerender } = render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    ).toBeInTheDocument();

    rerender(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={[]}
        isAdmin
        onPtsUpdated={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    ).toBeInTheDocument();

    rerender(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-existing']}
        onPtsUpdated={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /adicionar profissional/i }),
    ).not.toBeInTheDocument();

    rerender(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={[]}
        onPtsUpdated={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /adicionar profissional/i }),
    ).not.toBeInTheDocument();
  });

  it('filtra profissionais já na equipe e adiciona novo membro exibindo "Equipe atualizada."', async () => {
    const handlePtsUpdated = jest.fn();

    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (method === 'POST' && url.includes('/team')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ...mockPts,
              team: [...mockPts.team, candidateA],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [mockPts.responsible, mockPts.team[0], candidateA],
        });
      },
    );

    render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={handlePtsUpdated}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    );

    const checkboxA = await screen.findByRole('checkbox', {
      name: /Dr. Kaio Felipe/i,
    });
    expect(
      screen.queryByRole('checkbox', { name: /Dra. Ana Responsável/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Dr. Carlos Existente/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(checkboxA);
    fireEvent.click(screen.getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(handlePtsUpdated).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Equipe atualizada.')).toBeInTheDocument();
    });
  });

  it('exibe erro e destaca perfis conflitantes quando o backend retorna 400 TEAM_DUPLICATE_ACCOUNT', async () => {
    const handlePtsUpdated = jest.fn();

    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (method === 'POST' && url.includes('/team')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              status: 'TEAM_DUPLICATE_ACCOUNT',
              message:
                'A equipe não pode ter mais de um perfil da mesma conta, contando o responsável.',
              professionalIds: ['prof-new-a'],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [candidateA, candidateB],
        });
      },
    );

    render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={handlePtsUpdated}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    );

    const checkboxA = await screen.findByRole('checkbox', {
      name: /Dr. Kaio Felipe/i,
    });
    const checkboxB = await screen.findByRole('checkbox', {
      name: /Dra. Mariana Silva/i,
    });

    fireEvent.click(checkboxA);
    fireEvent.click(checkboxB);
    fireEvent.click(screen.getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A equipe não pode ter mais de um perfil da mesma conta, contando o responsável.',
      );
    });

    expect(handlePtsUpdated).not.toHaveBeenCalled();

    const conflictBadges = screen.getAllByText('Mesma conta já vinculada');
    expect(conflictBadges).toHaveLength(1);

    const conflictRow = screen.getByText('Dr. Kaio Felipe').closest('tr');
    const validRow = screen.getByText('Dra. Mariana Silva').closest('tr');
    expect(conflictRow).toHaveStyle({ backgroundColor: '#fef2f2' });
    expect(validRow).not.toHaveStyle({ backgroundColor: '#fef2f2' });

    fireEvent.click(screen.getByRole('checkbox', { name: /Dr. Kaio Felipe/i }));
    expect(
      screen.queryByText('Mesma conta já vinculada'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('redireciona para /login se a busca de profissionais retornar 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('redireciona para /login se o envio do formulário retornar 401', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (method === 'POST' && url.includes('/team')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Unauthorized' }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [candidateA],
        });
      },
    );

    render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    );

    const checkboxA = await screen.findByRole('checkbox', {
      name: /Dr. Kaio Felipe/i,
    });
    fireEvent.click(checkboxA);
    fireEvent.click(screen.getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('bloqueia envio sem seleção e exibe mensagem de validação se o formulário for submetido vazio', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [candidateA],
    });

    render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    );

    await screen.findByRole('checkbox', { name: /Dr. Kaio Felipe/i });

    const submitButton = screen.getByRole('button', {
      name: /^adicionar$/i,
    }) as HTMLButtonElement;
    expect(submitButton).toBeDisabled();

    submitButton.disabled = false;
    fireEvent.click(submitButton);

    await waitFor(() => {
      const postCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url, init]) =>
          String(url).includes('/team') && init?.method === 'POST',
      );
      expect(postCalls).toHaveLength(0);
    });
  });

  it('exibe erro genérico do servidor e erro de conexão em falhas de rede', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (method === 'POST' && url.includes('/team')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ message: 'Erro interno no servidor.' }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [candidateA],
        });
      },
    );

    render(
      <PtsTeamList
        pts={mockPts}
        currentUserProfileIds={['prof-resp']}
        onPtsUpdated={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar profissional/i }),
    );

    const checkboxA = await screen.findByRole('checkbox', {
      name: /Dr. Kaio Felipe/i,
    });
    fireEvent.click(checkboxA);
    fireEvent.click(screen.getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Erro interno no servidor.',
      );
    });

    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error'),
    );
    fireEvent.click(screen.getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Erro de conexão ao salvar a equipe.',
      );
    });
  });
});
