import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import MedicationsCard from './MedicationsCard';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';

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

describe('MedicationsCard', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      replace,
    });
  });

  it('lista as medicações do paciente em somente leitura', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respond(200, {
        data: [MEDICATION],
      }),
    );

    render(<MedicationsCard patientId="patient-1" canEdit={false} />);

    expect(await screen.findByText('Risperidona')).toBeInTheDocument();

    expect(screen.getByText('Dose: 0,5 mg')).toBeInTheDocument();

    expect(
      screen.getByText('Frequência: 1x ao dia, à noite'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Em uso', { selector: 'span.badge' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Adicionar medicação',
      }),
    ).not.toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1/medications`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('adiciona uma nova medicação', async () => {
    const saved = {
      ...MEDICATION,
      id: 'medication-2',
      drugName: 'Melatonina',
      dose: '3 mg',
      frequency: '1x ao dia',
      prescriber: null,
      reason: null,
      startDate: '2026-11-24',
    };

    global.fetch = jest.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.endsWith('/medications') && init?.method === 'POST') {
          return Promise.resolve(respond(201, saved));
        }

        return Promise.resolve(
          respond(200, {
            data: [],
          }),
        );
      },
    ) as jest.Mock;

    render(<MedicationsCard patientId="patient-1" canEdit />);

    await screen.findByText('Nenhuma medicação encontrada.');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Adicionar medicação',
      }),
    );

    fireEvent.change(screen.getByLabelText('Medicamento'), {
      target: { value: 'Melatonina' },
    });

    fireEvent.change(screen.getByLabelText('Dose'), {
      target: { value: '3 mg' },
    });

    fireEvent.change(screen.getByLabelText('Frequência'), {
      target: { value: '1x ao dia' },
    });

    fireEvent.change(screen.getByLabelText('Início'), {
      target: { value: '2026-11-24' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Adicionar',
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/patients/patient-1/medications`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );

    const body = JSON.parse(postCall[1].body as string);

    expect(body).toEqual({
      drugName: 'Melatonina',
      dose: '3 mg',
      frequency: '1x ao dia',
      startDate: '2026-11-24',
    });

    expect(await screen.findByText('Melatonina')).toBeInTheDocument();

    expect(
      screen.getByText('Medicação adicionada com sucesso'),
    ).toBeInTheDocument();
  });

  it('edita uma medicação enviando o registro completo', async () => {
    const saved = {
      ...MEDICATION,
      dose: '1 mg',
    };

    global.fetch = jest.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = String(url);

        if (
          requestUrl.endsWith('/medications/medication-1') &&
          init?.method === 'PATCH'
        ) {
          return Promise.resolve(respond(200, saved));
        }

        return Promise.resolve(
          respond(200, {
            data: [MEDICATION],
          }),
        );
      },
    ) as jest.Mock;

    render(<MedicationsCard patientId="patient-1" canEdit />);

    await screen.findByText('Risperidona');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Editar Risperidona',
      }),
    );

    fireEvent.change(screen.getByLabelText('Dose'), {
      target: { value: '1 mg' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/patients/patient-1/medications/medication-1`,
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
        }),
      );
    });

    const patchCall = (global.fetch as jest.Mock).mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    );

    const body = JSON.parse(patchCall[1].body as string);

    expect(body).toEqual({
      drugName: 'Risperidona',
      dose: '1 mg',
      frequency: '1x ao dia, à noite',
      prescriber: 'Dra. Maria Silva',
      reason: 'Controle de irritabilidade',
      startDate: '2026-11-01',
    });

    expect(await screen.findByText('Dose: 1 mg')).toBeInTheDocument();

    expect(
      screen.getByText('Medicação atualizada com sucesso'),
    ).toBeInTheDocument();
  });

  it('suspende a medicação sem removê-la da lista', async () => {
    const stopped = {
      ...MEDICATION,
      endDate: '2026-11-24',
    };

    global.fetch = jest.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = String(url);

        if (
          requestUrl.endsWith('/medications/medication-1/stop') &&
          init?.method === 'POST'
        ) {
          return Promise.resolve(respond(200, stopped));
        }

        return Promise.resolve(
          respond(200, {
            data: [MEDICATION],
          }),
        );
      },
    ) as jest.Mock;

    render(<MedicationsCard patientId="patient-1" canEdit />);

    await screen.findByText('Risperidona');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Suspender Risperidona',
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/patients/patient-1/medications/medication-1/stop`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    expect(await screen.findByText('Suspensa')).toBeInTheDocument();

    expect(screen.getByText('Risperidona')).toBeInTheDocument();

    expect(screen.getByText('Fim: 24/11/2026')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Suspender Risperidona',
      }),
    ).not.toBeInTheDocument();
  });

  it('mostra o erro da API e esconde ações após 403', async () => {
    global.fetch = jest.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            respond(403, {
              status: 'FORBIDDEN',
              message: 'Acesso restrito ao profissional.',
            }),
          );
        }

        return Promise.resolve(
          respond(200, {
            data: [],
          }),
        );
      },
    ) as jest.Mock;

    render(<MedicationsCard patientId="patient-1" canEdit />);

    await screen.findByText('Nenhuma medicação encontrada.');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Adicionar medicação',
      }),
    );

    fireEvent.change(screen.getByLabelText('Medicamento'), {
      target: { value: 'Risperidona' },
    });

    fireEvent.change(screen.getByLabelText('Dose'), {
      target: { value: '0,5 mg' },
    });

    fireEvent.change(screen.getByLabelText('Frequência'), {
      target: { value: '1x ao dia' },
    });

    fireEvent.change(screen.getByLabelText('Início'), {
      target: { value: '2026-11-24' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Adicionar',
      }),
    );

    expect(
      await screen.findByText('Acesso restrito ao profissional.'),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Adicionar medicação',
      }),
    ).not.toBeInTheDocument();
  });
});
