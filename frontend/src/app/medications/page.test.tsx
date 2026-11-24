import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import MedicationsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';

const PATIENT_ACCOUNT: Account = {
  accountId: 'account-patient-1',
  name: 'Ana Paciente',
  email: 'ana@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};

const MEDICATION = {
  id: 'medication-1',
  patientId: 'patient-1',
  drugName: 'Risperidona',
  dose: '0,5 mg',
  frequency: '1x ao dia, à noite',
  prescriber: 'Dra. Maria Silva',
  reason: 'Controle de irritabilidade',
  startDate: '2026-11-01',
  endDate: null,
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('MedicationsPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      replace,
    });

    global.fetch = jest.fn((url: string) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(respond(200, PATIENT_ACCOUNT));
      }

      if (url.endsWith('/patients/patient-1/medications')) {
        return Promise.resolve(
          respond(200, {
            data: [MEDICATION],
          }),
        );
      }

      throw new Error(`Requisição inesperada: ${url}`);
    }) as jest.Mock;
  });

  it('mostra as próprias medicações somente para leitura', async () => {
    render(<MedicationsPage />);

    expect(
      await screen.findByText('Risperidona'),
    ).toBeInTheDocument();

    expect(screen.getByText('Dose: 0,5 mg')).toBeInTheDocument();

    expect(
      screen.getByText('Frequência: 1x ao dia, à noite'),
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1/medications`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );

    expect(
      screen.getByRole('link', { name: 'Medicações' }),
    ).toHaveAttribute('aria-current', 'page');

    expect(
      screen.queryByRole('button', {
        name: 'Adicionar medicação',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Editar Risperidona',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Suspender Risperidona',
      }),
    ).not.toBeInTheDocument();
  });
});