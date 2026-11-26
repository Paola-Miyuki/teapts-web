import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const MELATONINA = {
  ...MEDICATION,
  id: 'medication-2',
  drugName: 'Melatonina',
  dose: '3 mg',
  prescriber: null,
  reason: null,
  startDate: '2026-06-12',
};
const METILFENIDATO = {
  ...MEDICATION,
  id: 'medication-3',
  drugName: 'Metilfenidato',
  dose: '10 mg',
  startDate: '2026-01-10',
  endDate: '2026-03-20',
};

describe('MedicationsPage', () => {
  const replace = jest.fn();
  let medications: unknown[];

  beforeEach(() => {
    jest.clearAllMocks();
    medications = [MEDICATION, MELATONINA, METILFENIDATO];

    (useRouter as jest.Mock).mockReturnValue({
      replace,
    });

    global.fetch = jest.fn((url: string) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(respond(200, PATIENT_ACCOUNT));
      }

      if (url.endsWith('/patients/patient-1/medications')) {
        return Promise.resolve(respond(200, { data: medications }));
      }

      throw new Error(`Requisição inesperada: ${url}`);
    }) as jest.Mock;
  });

  function rowNames() {
    return screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
  }

  it('mostra as medicações em tabela, somente para leitura', async () => {
    render(<MedicationsPage />);

    expect(await screen.findByText('Risperidona')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Medicações' })).toBeVisible();
    expect(screen.getByText('Minhas medicações')).toBeInTheDocument();
    expect(screen.getByText('3 medicações')).toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual([
      'Medicamento',
      'Dose',
      'Frequência',
      'Prescritor',
      'Início',
      'Fim',
      'Situação',
      'Ações',
    ]);

    const row = screen.getByText('Risperidona').closest('tr')!;

    expect(within(row).getByText('0,5 mg')).toBeInTheDocument();
    expect(within(row).getByText('01/11/2026')).toBeInTheDocument();
    expect(within(row).getByText('Em uso')).toBeInTheDocument();
    expect(
      within(screen.getByText('Metilfenidato').closest('tr')!).getByText(
        'Suspensa',
      ),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1/medications`,
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(screen.getByRole('link', { name: 'Medicações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.queryByRole('button', { name: /Adicionar|Editar|Suspender/ }),
    ).not.toBeInTheDocument();
  });

  it('ordena pela data de início, da mais recente para a mais antiga', async () => {
    render(<MedicationsPage />);
    await screen.findByText('Risperidona');

    expect(rowNames()).toEqual(['Risperidona', 'Melatonina', 'Metilfenidato']);

    await userEvent.click(
      screen.getByRole('button', { name: 'Ordem decrescente' }),
    );

    expect(rowNames()).toEqual(['Metilfenidato', 'Melatonina', 'Risperidona']);

    await userEvent.selectOptions(
      screen.getByLabelText('Ordenar por'),
      'drugName',
    );

    expect(rowNames()).toEqual(['Melatonina', 'Metilfenidato', 'Risperidona']);
  });

  it('busca pelo nome do medicamento, sem diferenciar acentos', async () => {
    render(<MedicationsPage />);
    await screen.findByText('Risperidona');

    await userEvent.type(screen.getByLabelText('Busca'), 'MELATON');

    expect(rowNames()).toEqual(['Melatonina']);

    await userEvent.clear(screen.getByLabelText('Busca'));
    await userEvent.type(screen.getByLabelText('Busca'), 'xyz');

    expect(
      screen.getByRole('heading', { name: 'Nenhuma medicação encontrada' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Revise a busca ou limpe os filtros.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(rowNames()).toHaveLength(3);
  });

  it('filtra pela situação e pelo período personalizado', async () => {
    render(<MedicationsPage />);
    await screen.findByText('Risperidona');

    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Suspensa' }));

    expect(rowNames()).toEqual(['Metilfenidato']);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Suspensa' }));
    await userEvent.selectOptions(screen.getByLabelText('Período'), 'custom');
    await userEvent.type(screen.getByLabelText('De'), '2026-05-01');
    await userEvent.type(screen.getByLabelText('Até'), '2026-12-31');

    expect(rowNames()).toEqual(['Risperidona', 'Melatonina']);
  });

  it('abre os detalhes pelo menu Visualizar, com o motivo', async () => {
    render(<MedicationsPage />);
    await screen.findByText('Risperidona');

    await userEvent.click(
      screen.getByRole('button', { name: 'Ações para Risperidona' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Visualizar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Risperidona' });

    expect(within(dialog).getByText('Motivo')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Controle de irritabilidade'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Dra. Maria Silva')).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getAllByRole('button', { name: 'Fechar' })[1],
    );

    expect(
      screen.queryByRole('dialog', { name: 'Risperidona' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há medicações', async () => {
    medications = [];

    render(<MedicationsPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Nenhuma medicação encontrada',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ainda não há medicações registradas.'),
    ).toBeInTheDocument();
  });

  it('mostra o erro da API e deixa tentar de novo', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url.endsWith('/me')
        ? Promise.resolve(respond(200, PATIENT_ACCOUNT))
        : Promise.resolve(
            respond(500, { status: 'ERROR', message: 'Falha no servidor' }),
          ),
    );

    render(<MedicationsPage />);

    expect(await screen.findByText('Falha no servidor')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });
});
