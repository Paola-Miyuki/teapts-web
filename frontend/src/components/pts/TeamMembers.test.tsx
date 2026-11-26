import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import TeamMembers, { type TeamProfessional } from './TeamMembers';

const people: TeamProfessional[] = [
  { id: 'p1', name: 'Ana Lima', specialism: { name: 'Psicólogo' } },
  { id: 'p2', name: 'Bruno Souza', specialism: { name: 'Fonoaudiólogo' } },
];

function Harness({ addOnSelect = true }: { addOnSelect?: boolean }) {
  const [ids, setIds] = useState<string[]>([]);

  return (
    <TeamMembers
      professionals={people}
      selectedIds={ids}
      onChange={setIds}
      addOnSelect={addOnSelect}
    />
  );
}

const field = () => screen.getByRole('combobox', { name: 'Adicionar membro' });

describe('TeamMembers com addOnSelect', () => {
  it('mostra o estado vazio e a regra no tooltip', () => {
    render(<Harness />);

    expect(
      screen.getByText('Nenhum membro além do responsável.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Só profissionais ativos. Cada conta entra uma vez na equipe, contando o responsável.',
    );
    expect(screen.queryByText(/opcional/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Adicionar' }),
    ).not.toBeInTheDocument();
  });

  it('filtra por nome ou especialidade', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), 'fono');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Bruno Souza/ })).toBeVisible();
  });

  it('inclui ao escolher, esvazia o campo e devolve ao remover', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.click(screen.getByRole('option', { name: /Ana Lima/ }));

    expect(field()).toHaveValue('');
    expect(
      screen.queryByText('Nenhum membro além do responsável.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Psicólogo')).toBeInTheDocument();

    await user.click(field());
    expect(screen.queryByRole('option', { name: /Ana Lima/ })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Remover Ana Lima da equipe' }),
    );
    await user.click(field());
    expect(screen.getByRole('option', { name: /Ana Lima/ })).toBeVisible();
  });

  it('é operável por teclado', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(field()).toHaveAttribute('aria-controls');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
  });
});

describe('TeamMembers sem addOnSelect', () => {
  it('mantém o botão Adicionar', async () => {
    const user = userEvent.setup();
    render(<Harness addOnSelect={false} />);

    await user.click(field());
    await user.click(screen.getByRole('option', { name: /Ana Lima/ }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(
      screen.getByRole('button', { name: 'Remover Ana Lima da equipe' }),
    ).toBeInTheDocument();
  });
});
