import { render, screen, waitFor } from '@testing-library/react';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';

import PatientDetail from './PatientDetail';
import { personalData } from '@/test-utils/account';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';

const PROFESSIONAL: Account = {
  accountId: 'professional-uuid',
  name: 'Paula Profissional',
  email: 'paula@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['professional-profile'],
};

const PATIENT = {
  id: 'patient-1',
  name: 'Ana Clara Ribeiro',
  socialName: null,
  email: 'ribeiro.familia@gmail.com',
  cpf: '11144477735',
  cns: '700001234567891',
  guardianName: 'Juliana Ribeiro',
  registeredAt: '2026-02-14T12:00:00.000Z',
  ptsStatus: 'concluded',
  activePtsId: null,
  readOnly: true,
  supportContacts: [
    {
      id: 'contact-1',
      name: 'Rosa Ribeiro',
      description: 'Avó',
      email: null,
      phone: '41996772211',
      isEmergency: false,
    },
  ],
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockApi(detail: Response) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve(url.endsWith('/me') ? respond(200, PROFESSIONAL) : detail),
  ) as jest.Mock;
}

describe('PatientDetail', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('mostra os dados do paciente, só leitura para PTS encerrado', async () => {
    mockApi(respond(200, PATIENT));

    render(<PatientDetail id="patient-1" />);

    expect(
      await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' }),
    ).toBeInTheDocument();
    expect(screen.getByText('111.444.777-35')).toBeInTheDocument();
    expect(screen.getByText('700 0012 3456 7891')).toBeInTheDocument();
    expect(screen.getAllByText('Juliana Ribeiro')).not.toHaveLength(0);
    expect(screen.getByText('Concluído')).toHaveClass('badge', 'concluded');
    expect(screen.getByText('Rosa Ribeiro')).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('leva ao PTS ativo do paciente', async () => {
    mockApi(
      respond(200, {
        ...PATIENT,
        ptsStatus: 'running',
        activePtsId: 'pts-1',
        readOnly: false,
      }),
    );

    render(<PatientDetail id="patient-1" />);

    expect(
      await screen.findByRole('link', { name: 'Abrir PTS' }),
    ).toHaveAttribute('href', '/pts/pts-1');
  });

  it('não mostra o link sem PTS ativo', async () => {
    mockApi(respond(200, PATIENT));

    render(<PatientDetail id="patient-1" />);

    await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' });
    expect(
      screen.queryByRole('link', { name: 'Abrir PTS' }),
    ).not.toBeInTheDocument();
  });

  it('mostra "Sem acesso" no 403', async () => {
    mockApi(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao profissional.',
      }),
    );

    render(<PatientDetail id="patient-1" />);

    expect(
      await screen.findByText('Sem acesso a este paciente'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar para pacientes' }),
    ).toHaveAttribute('href', '/patients');
  });

  it('redireciona para o login no 401', async () => {
    mockApi(respond(401, {}));

    render(<PatientDetail id="patient-1" />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
