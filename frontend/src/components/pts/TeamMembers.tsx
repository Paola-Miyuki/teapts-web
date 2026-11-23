'use client';

import { useState } from 'react';

import Combobox from '@/components/Combobox';
import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import { initials } from '@/lib/format';

export type TeamProfessional = {
  id: string;
  name: string;
  specialism: { name: string };
};

type TeamMembersProps = {
  // Profissionais que podem entrar (sem o responsável).
  professionals: TeamProfessional[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

function label(professional: TeamProfessional) {
  return `${professional.name} · ${professional.specialism.name}`;
}

// Seção "Membros da equipe" de `criar-pts.html` e `editar-proposta.html`:
// busca por nome ou especialidade, "Adicionar" e a lista com remover.
export default function TeamMembers({
  professionals,
  selectedIds,
  onChange,
  disabled,
}: TeamMembersProps) {
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState('');
  const term = input.trim().toLocaleLowerCase('pt-BR');
  const selected = selectedIds
    .map((id) => professionals.find((professional) => professional.id === id))
    .filter((professional): professional is TeamProfessional =>
      Boolean(professional),
    );
  const options = professionals
    .filter((professional) => !selectedIds.includes(professional.id))
    .filter(
      (professional) =>
        !term || label(professional).toLocaleLowerCase('pt-BR').includes(term),
    )
    .map((professional) => ({
      value: professional.id,
      label: label(professional),
    }));

  function add() {
    if (!pendingId || selectedIds.includes(pendingId)) {
      return;
    }

    onChange([...selectedIds, pendingId]);
    setPendingId('');
    setInput('');
  }

  return (
    <section className="ux-fsection">
      <header>
        <span className="ux-titletip">
          <h3>Membros da equipe</h3>
          <HelpTooltip id="team-tip" label="Membros da equipe">
            Cada conta entra uma vez na equipe, contando o responsável.
          </HelpTooltip>
        </span>
      </header>
      <div>
        <div className="field">
          <label className="field-label" htmlFor="team-member">
            Adicionar membro
          </label>
          <div className="ux-inline">
            <Combobox
              id="team-member"
              options={options}
              input={input}
              onInputChange={(text) => {
                setInput(text);
                setPendingId('');
              }}
              onSelect={(option) => {
                setInput(option.label);
                setPendingId(option.value);
              }}
              placeholder="Busque por nome ou especialidade"
              emptyText="Nenhum profissional encontrado."
              listLabel="Profissionais"
              disabled={disabled}
              describedBy="team-tip"
            />
            <button
              type="button"
              className="btn"
              disabled={disabled || !pendingId}
              onClick={add}
            >
              <Icon name="plus" className="icon-sm" />
              Adicionar
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <ul className="mini-list ux-contacts ux-members">
            {selected.map((professional) => (
              <li key={professional.id}>
                <span className="avatar" aria-hidden="true">
                  {initials(professional.name)}
                </span>
                <span className="grow">
                  <strong>{professional.name}</strong>
                  <small>{professional.specialism.name}</small>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover ${professional.name} da equipe`}
                  disabled={disabled}
                  onClick={() =>
                    onChange(selectedIds.filter((id) => id !== professional.id))
                  }
                >
                  <Icon name="trash" className="icon" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
