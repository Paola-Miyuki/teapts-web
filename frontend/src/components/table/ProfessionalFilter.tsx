'use client';

import { useEffect, useId, useState } from 'react';

import { getProfessionals, type Professional } from '@/lib/professionals';

type ProfessionalFilterProps = {
  label: string;
  value: string;
  onChange: (id: string) => void;
};

// Filtro de profissional por autocomplete (RFPRO001): a URL guarda o id, e o
// nome é buscado de novo ao recarregar.
export default function ProfessionalFilter({
  label,
  value,
  onChange,
}: ProfessionalFilterProps) {
  const listId = useId();
  const [text, setText] = useState('');
  const [options, setOptions] = useState<Professional[]>([]);
  const [lastValue, setLastValue] = useState(value);

  // "Limpar" zera o filtro de fora: o texto digitado sai junto.
  if (lastValue !== value) {
    setLastValue(value);

    if (!value) {
      setText('');
    }
  }

  useEffect(() => {
    if (!value) {
      return;
    }

    let active = true;

    getProfessionals({ page: 1, limit: 1, ids: [value] })
      .then((response) => {
        if (active && response.data[0]) {
          setText(response.data[0].name);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [value]);

  useEffect(() => {
    const term = text.trim();

    if (term.length < 2) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      getProfessionals({ page: 1, limit: 10, name: term })
        .then((response) => {
          if (active) {
            setOptions(response.data);
          }
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text]);

  function handleChange(next: string) {
    setText(next);
    const match = options.find((option) => option.name === next);

    if (match) {
      onChange(match.id);
    } else if (!next.trim() && value) {
      onChange('');
    }
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        list={listId}
        placeholder="Nome ou e-mail"
        autoComplete="off"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.name} />
        ))}
      </datalist>
    </label>
  );
}
