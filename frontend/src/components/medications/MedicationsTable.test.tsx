import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import MedicationsTable from './MedicationsTable';

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
const STOPPED = {
  ...MEDICATION,
  id: 'medication-2',
  drugName: 'Metilfenidato',
  startDate: '2026-01-10',
  endDate: '2026-03-20',
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function mockApi(medications: unknown[], handler?: Handler) {
  global.fetch = jest.fn((url: string | URL | Request, init?: RequestInit) => {
    const custom = handler?.(String(url), init);

    return Promise.resolve(custom ?? respond(200, { data: medications }));
  }) as jest.Mock;
}

function calls(method: string) {
  return (global.fetch as jest.Mock).mock.calls.filter(
    ([, init]) => (init?.method ?? 'GET') === method,
  );
}

async function openMenu(drug: string, item: string) {
  fireEvent.click(screen.getByRole('button', { name: `Ações para ${drug}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
}

describe('MedicationsTable', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('lista as medicações em tabela, como no mockup, e só lê quando não pode editar', async () => {
    mockApi([MEDICATION, STOPPED]);

    render(<MedicationsTable patientId="patient-1" title="Medicações" />);

    expect(await screen.findByText('Risperidona')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Medicações' })).toBeVisible();
    expect(screen.getByText('2 medicações')).toBeInTheDocument();
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
    expect(within(row).getByText('Dra. Maria Silva')).toBeInTheDocument();
    expect(within(row).getByText('01/11/2026')).toBeInTheDocument();
    expect(within(row).getByText('Em uso')).toHaveClass('badge', 'active');
    expect(
      within(screen.getByText('Metilfenidato').closest('tr')!).getByText(
        'Suspensa',
      ),
    ).toHaveClass('badge', 'inactive');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1/medications`,
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Adicionar medicação' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ações para Risperidona' }),
    );

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent?.trim()),
    ).toEqual(['Visualizar']);
  });

  it('abre o modal de visualização com os dados da medicação', async () => {
    mockApi([MEDICATION]);

    render(<MedicationsTable patientId="patient-1" />);

    await screen.findByText('Risperidona');
    await openMenu('Risperidona', 'Visualizar');

    const dialog = screen.getByRole('dialog');

    expect(
      within(dialog).getByText('Controle de irritabilidade'),
    ).toBeVisible();
    expect(within(dialog).getByText('Em uso')).toBeInTheDocument();
  });

  it('busca pelo nome e filtra pela situação', async () => {
    mockApi([MEDICATION, STOPPED]);

    render(<MedicationsTable patientId="patient-1" />);

    await screen.findByText('Risperidona');

    fireEvent.change(screen.getByPlaceholderText('Nome do medicamento'), {
      target: { value: 'metil' },
    });

    expect(screen.queryByText('Risperidona')).not.toBeInTheDocument();
    expect(screen.getByText('Metilfenidato')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByLabelText('Suspensa'));

    expect(screen.queryByText('Risperidona')).not.toBeInTheDocument();
    expect(screen.getByText('Metilfenidato')).toBeInTheDocument();
  });

  it('mostra o estado vazio e o erro de carga com nova tentativa', async () => {
    mockApi([]);

    const { unmount } = render(<MedicationsTable patientId="patient-1" />);

    expect(
      await screen.findByText('Nenhuma medicação encontrada'),
    ).toBeInTheDocument();

    unmount();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        respond(500, { status: 'ERROR', message: 'Falha.' }),
      )
      .mockResolvedValue(respond(200, { data: [MEDICATION] }));

    render(<MedicationsTable patientId="patient-1" />);

    expect(await screen.findByText('Falha.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Risperidona')).toBeInTheDocument();
  });

  it('manda para o login no 401', async () => {
    mockApi([], () => respond(401, {}));

    render(<MedicationsTable patientId="patient-1" />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  describe('com permissão de editar', () => {
    it('mostra o botão primário e abre o modal igual ao mockup', async () => {
      mockApi([]);

      render(
        <MedicationsTable
          patientId="patient-1"
          patientName="Ana Clara Ribeiro"
          title="Medicações"
          canEdit
        />,
      );

      await screen.findByText('Nenhuma medicação encontrada');

      const open = screen.getByRole('button', { name: 'Adicionar medicação' });

      expect(open).toHaveClass('btn', 'btn-sm', 'btn-primary');

      fireEvent.click(open);

      const dialog = screen.getByRole('dialog');

      expect(
        within(dialog).getByRole('heading', { name: 'Adicionar medicação' }),
      ).toBeInTheDocument();
      expect(within(dialog).getByText('Ana Clara Ribeiro')).toBeInTheDocument();
      expect(dialog.querySelector('.modal-head .avatar')).toBeInTheDocument();
      expect(dialog).not.toHaveClass('modal-sm');
      expect(screen.getByPlaceholderText('Ex.: Risperidona')).toBeVisible();
      expect(screen.getByPlaceholderText('Ex.: 0,5 mg')).toBeVisible();
      expect(
        screen.getByPlaceholderText('Ex.: 1x ao dia, à noite'),
      ).toBeVisible();
      expect(screen.getByPlaceholderText('Ex.: Dr. Carlos Lima')).toBeVisible();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    function fillAndSubmit() {
      fireEvent.change(screen.getByLabelText(/^Medicamento/), {
        target: { value: 'Melatonina' },
      });
      fireEvent.change(screen.getByLabelText(/^Dose/), {
        target: { value: '3 mg' },
      });
      fireEvent.change(screen.getByLabelText(/^Frequência/), {
        target: { value: '1x ao dia' },
      });
      fireEvent.change(screen.getByLabelText(/^Data de início/), {
        target: { value: '2026-11-24' },
      });
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Adicionar medicação',
        }),
      );
    }

    it('adiciona uma medicação pelo modal e a coloca na tabela', async () => {
      const saved = {
        ...MEDICATION,
        id: 'medication-3',
        drugName: 'Melatonina',
        dose: '3 mg',
        frequency: '1x ao dia',
        startDate: '2026-11-24',
      };

      mockApi([], (_url, init) =>
        init?.method === 'POST' ? respond(201, saved) : undefined,
      );

      render(<MedicationsTable patientId="patient-1" canEdit />);

      await screen.findByText('Nenhuma medicação encontrada');
      fireEvent.click(
        screen.getByRole('button', { name: 'Adicionar medicação' }),
      );
      fillAndSubmit();

      expect(await screen.findByText('Melatonina')).toBeInTheDocument();
      expect(
        screen.getByText('Medicação adicionada com sucesso'),
      ).toBeInTheDocument();
      expect(JSON.parse(calls('POST')[0][1].body as string)).toEqual({
        drugName: 'Melatonina',
        dose: '3 mg',
        frequency: '1x ao dia',
        startDate: '2026-11-24',
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('valida os obrigatórios e o intervalo de datas sem chamar a API', async () => {
      mockApi([]);

      render(<MedicationsTable patientId="patient-1" canEdit />);

      await screen.findByText('Nenhuma medicação encontrada');
      fireEvent.click(
        screen.getByRole('button', { name: 'Adicionar medicação' }),
      );
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Adicionar medicação',
        }),
      );

      expect(
        screen.getByText(
          'Informe medicamento, dose, frequência e data de início',
        ),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/^Medicamento/), {
        target: { value: 'X' },
      });
      fireEvent.change(screen.getByLabelText(/^Dose/), {
        target: { value: '1' },
      });
      fireEvent.change(screen.getByLabelText(/^Frequência/), {
        target: { value: '1x' },
      });
      fireEvent.change(screen.getByLabelText(/^Data de início/), {
        target: { value: '2026-11-24' },
      });
      fireEvent.change(screen.getByLabelText(/^Data de fim/), {
        target: { value: '2026-11-01' },
      });
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Adicionar medicação',
        }),
      );

      expect(
        screen.getByText(
          'A data de fim não pode ser anterior à data de início',
        ),
      ).toBeInTheDocument();
      expect(calls('POST')).toHaveLength(0);
    });

    it('edita pelo menu da linha e atualiza a tabela', async () => {
      mockApi([MEDICATION], (url, init) =>
        init?.method === 'PATCH' && url.endsWith('/medications/medication-1')
          ? respond(200, { ...MEDICATION, dose: '1 mg' })
          : undefined,
      );

      render(<MedicationsTable patientId="patient-1" canEdit />);

      await screen.findByText('Risperidona');
      await openMenu('Risperidona', 'Editar');

      expect(
        within(screen.getByRole('dialog')).getByRole('heading', {
          name: 'Editar medicação',
        }),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/^Dose/), {
        target: { value: '1 mg' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Salvar alterações' }),
      );

      expect(await screen.findByText('1 mg')).toBeInTheDocument();
      expect(
        screen.getByText('Medicação atualizada com sucesso'),
      ).toBeInTheDocument();
      expect(JSON.parse(calls('PATCH')[0][1].body as string)).toMatchObject({
        drugName: 'Risperidona',
        dose: '1 mg',
        startDate: '2026-11-01',
      });
    });

    it('suspende só depois de confirmar, e só as que estão em uso', async () => {
      mockApi([MEDICATION, STOPPED], (url, init) =>
        init?.method === 'POST' && url.endsWith('/medication-1/stop')
          ? respond(200, { ...MEDICATION, endDate: '2026-11-25' })
          : undefined,
      );

      render(<MedicationsTable patientId="patient-1" canEdit />);

      await screen.findByText('Risperidona');

      fireEvent.click(
        screen.getByRole('button', { name: 'Ações para Metilfenidato' }),
      );

      expect(
        within(
          screen.getByRole('button', { name: 'Ações para Metilfenidato' })
            .parentElement!,
        ).queryByRole('menuitem', { name: 'Suspender' }),
      ).not.toBeInTheDocument();

      await openMenu('Risperidona', 'Suspender');

      const dialog = screen.getByRole('dialog');

      expect(
        within(dialog).getByRole('heading', { name: 'Suspender Risperidona?' }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          'A data de fim passa a ser hoje. O registro continua no histórico de medicações.',
        ),
      ).toBeInTheDocument();
      expect(calls('POST')).toHaveLength(0);

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Suspender medicação' }),
      );

      expect(
        await screen.findByText('Medicação suspensa com sucesso'),
      ).toBeInTheDocument();

      const row = screen.getByText('Risperidona').closest('tr')!;

      expect(within(row).getByText('Suspensa')).toBeInTheDocument();
      expect(within(row).getByText('25/11/2026')).toBeInTheDocument();
    });

    it('cancelar a suspensão não chama a API', async () => {
      mockApi([MEDICATION]);

      render(<MedicationsTable patientId="patient-1" canEdit />);

      await screen.findByText('Risperidona');
      await openMenu('Risperidona', 'Suspender');
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Cancelar',
        }),
      );

      expect(calls('POST')).toHaveLength(0);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('mostra a mensagem da API e esconde as ações de escrita após 403', async () => {
      mockApi([MEDICATION], (_url, init) =>
        init?.method === 'POST'
          ? respond(403, {
              status: 'FORBIDDEN',
              message: 'Acesso restrito ao profissional.',
            })
          : undefined,
      );

      render(<MedicationsTable patientId="patient-1" canEdit />);

      await screen.findByText('Risperidona');
      fireEvent.click(
        screen.getByRole('button', { name: 'Adicionar medicação' }),
      );
      fireEvent.change(screen.getByLabelText(/^Medicamento/), {
        target: { value: 'X' },
      });
      fireEvent.change(screen.getByLabelText(/^Dose/), {
        target: { value: '1' },
      });
      fireEvent.change(screen.getByLabelText(/^Frequência/), {
        target: { value: '1x' },
      });
      fireEvent.change(screen.getByLabelText(/^Data de início/), {
        target: { value: '2026-11-24' },
      });
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Adicionar medicação',
        }),
      );

      expect(
        await screen.findByText('Acesso restrito ao profissional.'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Adicionar medicação' }),
      ).not.toBeInTheDocument();
    });
  });
});
