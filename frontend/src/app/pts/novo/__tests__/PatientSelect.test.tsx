import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import PatientSelect from '../_components/PatientSelect';
import { ApiError } from '../api/http';
import * as api from '../api/ptsApi';
import type { EligiblePatient } from '../types';

jest.mock('../api/ptsApi', () => ({
  listEligiblePatients: jest.fn(),
}));

// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const list = api.listEligiblePatients as jest.Mock;

const maria: EligiblePatient = {
  id: 'patient-1',
  name: 'Maria Silva',
  email: 'maria@exemplo.com',
};
const mariana: EligiblePatient = {
  id: 'patient-2',
  name: 'Mariana Costa',
  email: 'mariana@exemplo.com',
};

function Harness({
  onChange,
}: {
  onChange?: (p: EligiblePatient | null) => void;
}) {
  const [value, setValue] = useState<EligiblePatient | null>(null);

  return (
    <PatientSelect
      id="patient"
      value={value}
      onChange={(patient) => {
        setValue(patient);
        onChange?.(patient);
      }}
    />
  );
}

function field() {
  return screen.getByRole('combobox');
}

beforeEach(() => {
  jest.resetAllMocks();
  list.mockResolvedValue([maria, mariana]);
});

describe('PatientSelect', () => {
  it('não busca sem 2 caracteres e avisa o mínimo', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), ' m ');

    expect(
      await screen.findByText('Digite ao menos 2 caracteres para buscar.'),
    ).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it('busca com o termo sem espaços externos e mostra nome e e-mail', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), '  mar ');

    expect(
      await screen.findByRole('option', {
        name: 'Maria Silva · maria@exemplo.com',
      }),
    ).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({
      q: 'mar',
      signal: expect.any(AbortSignal),
    });
    expect(screen.queryByText(/\d{3}\.\d{3}/)).not.toBeInTheDocument();
  });

  it('busca na hora com Enter, sem esperar o debounce', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), 'mar{Enter}');

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  });

  it('mostra o texto de nenhum paciente elegível sem resultado', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue([]);
    render(<Harness />);

    await user.type(field(), 'zz');

    expect(
      await screen.findByText(
        'Nenhum paciente elegível encontrado. Pacientes com PTS ativo ou rascunho não aparecem aqui.',
      ),
    ).toBeInTheDocument();
  });

  it('navega por setas, escolhe com Enter e preenche o campo', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), 'mar');
    await screen.findByRole('option', { name: /Maria Silva/ });

    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(field()).toHaveAttribute(
      'aria-controls',
      screen.getByRole('listbox').id,
    );

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(field()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Mariana/ }).id,
    );

    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenLastCalledWith(mariana);
    expect(field()).toHaveValue('Mariana Costa · mariana@exemplo.com');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc fecha a lista e o ✕ limpa o campo e a escolha', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), 'mar');
    await user.click(
      await screen.findByRole('option', { name: /Maria Silva/ }),
    );
    expect(field()).toHaveValue('Maria Silva · maria@exemplo.com');

    await user.click(
      screen.getByRole('button', { name: 'Limpar campo do paciente' }),
    );

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();

    await user.type(field(), 'ma');
    await screen.findByRole('option', { name: /Maria Silva/ });
    await user.keyboard('{Escape}');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Escape}');
    expect(field()).toHaveValue('');
  });

  it('mantém os resultados anteriores enquanto a nova busca carrega', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), 'mar');
    await screen.findByRole('option', { name: /Maria Silva/ });

    list.mockReturnValue(new Promise(() => undefined));
    await user.type(field(), 'i');

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole('option', { name: /Maria Silva/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
  });

  it('cancela a requisição anterior e descarta a resposta superada', async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    let resolveFirst!: (patients: EligiblePatient[]) => void;

    list
      .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise((resolve) => (resolveFirst = resolve));
      })
      .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return Promise.resolve([mariana]);
      });
    render(<Harness />);

    await user.type(field(), 'ma');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await user.type(field(), 'r');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    expect(signals[0].aborted).toBe(true);
    expect(
      await screen.findByRole('option', { name: /Mariana/ }),
    ).toBeInTheDocument();

    resolveFirst([maria]);

    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: /Maria Silva/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it('401 redireciona para /login', async () => {
    const user = userEvent.setup();
    list.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED'));
    render(<Harness />);

    await user.type(field(), 'mar');

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/login'),
    );
  });

  it('403 mostra o acesso restrito a profissionais', async () => {
    const user = userEvent.setup();
    list.mockRejectedValue(
      new ApiError(403, 'FORBIDDEN', 'Acesso restrito ao profissional.'),
    );
    render(<Harness />);

    await user.type(field(), 'mar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Acesso restrito a profissionais.',
    );
  });

  it('outros erros mostram a message da API e permitem tentar de novo', async () => {
    const user = userEvent.setup();
    list.mockRejectedValueOnce(
      new ApiError(400, 'ERROR', 'Parâmetro inválido: q'),
    );
    render(<Harness />);

    await user.type(field(), 'mar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Parâmetro inválido: q',
    );

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByRole('option', { name: /Maria Silva/ }),
    ).toBeInTheDocument();
  });
});
