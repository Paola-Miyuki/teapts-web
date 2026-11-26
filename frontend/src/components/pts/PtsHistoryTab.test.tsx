import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import PtsHistoryTab from './PtsHistoryTab';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const item = {
  id: 'pts-old',
  version: 1,
  status: 'concluded',
  responsible: {
    id: 'professional-1',
    name: 'Ana Souza',
    specialism: 'Psicologia',
  },
  team: [{ id: 'professional-2', name: 'João Lima' }],
  createdAt: '2025-03-01T12:00:00.000Z',
  acceptedAt: '2025-03-05T12:00:00.000Z',
  beganAt: '2025-03-10T12:00:00.000Z',
  closedAt: '2025-12-30T12:00:00.000Z',
  goalsResult: { achieved: 2, partiallyAchieved: 1, notAchieved: 0 },
};

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('PtsHistoryTab', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('shows PTS history, opens it read-only, and paginates', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        respond(200, {
          data: [item],
          pagination: { page: 1, limit: 25, total: 26, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(
        respond(200, {
          data: [{ ...item, id: 'pts-older', version: 2 }],
          pagination: { page: 2, limit: 25, total: 26, totalPages: 2 },
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PtsHistoryTab patientId="patient-1" />);

    expect(
      await screen.findByRole('heading', { name: 'Histórico de PTS' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByText('2 atingidas')).toBeInTheDocument();
    expect(screen.getByLabelText('Equipe do PTS')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Ações' }),
    ).toBeInTheDocument();
    const openPtsLink = screen.getByRole('link', { name: 'Abrir PTS' });
    expect(openPtsLink).toHaveClass('btn', 'btn-sm', 'btn-primary');
    expect(openPtsLink).toHaveAttribute(
      'href',
      '/pts/pts-old?readonly=1&version=1',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/patients/patient-1/pts?page=1&limit=25',
      expect.anything(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3000/patients/patient-1/pts?page=2&limit=25',
        expect.anything(),
      ),
    );
    expect(await screen.findByText('v2')).toBeInTheDocument();
  });

  it('renders forbidden and not-found errors', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Você não tem acesso ao histórico deste paciente.',
      }),
    ) as unknown as typeof fetch;

    const { rerender } = render(<PtsHistoryTab patientId="patient-1" />);
    expect(
      await screen.findByText('Sem acesso ao histórico deste paciente'),
    ).toBeInTheDocument();

    global.fetch = jest.fn().mockResolvedValue(
      respond(404, {
        status: 'PATIENT_NOT_FOUND',
        message: 'Paciente não encontrado.',
      }),
    ) as unknown as typeof fetch;

    rerender(<PtsHistoryTab patientId="patient-2" />);
    expect(
      await screen.findByText('Paciente não encontrado'),
    ).toBeInTheDocument();
  });
});
