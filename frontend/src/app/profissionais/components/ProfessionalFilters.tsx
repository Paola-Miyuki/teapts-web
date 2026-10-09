'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import type { Filters, ProfessionalSpecialism } from './Professionals';
import styles from '../profissionais.module.css';

type ProfessionalFiltersProps = {
  filters: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
};

export default function ProfessionalFilters({
  filters,
  onApply,
  onClear,
}: ProfessionalFiltersProps) {
  const [name, setName] = useState(filters.name);

  const [specialism, setSpecialism] = useState<ProfessionalSpecialism | ''>(
    filters.specialism,
  );

  const [ids, setIds] = useState(filters.ids);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onApply({
      name,
      specialism,
      ids,
    });
  }

  function handleClear() {
    setName('');
    setSpecialism('');
    setIds('');

    onClear();
  }

  return (
    <form className={styles.filters} onSubmit={handleSubmit}>
      <div className={styles.filterMain}>
        <label className={styles.search}>
          <span>Nome</span>

          <div className={styles.inputWithIcon}>
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="6" />
              <path d="m15 15 6 6" />
            </svg>

            <input
              type="text"
              value={name}
              placeholder="Buscar por nome"
              aria-label="Nome"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
        </label>

        <label className={styles.filterField}>
          <span>Especialidade</span>

          <select
            value={specialism}
            aria-label="Especialidade"
            onChange={(event) => {
              setSpecialism(event.target.value as ProfessionalSpecialism | '');
            }}
          >
            <option value="">Todas as especialidades</option>

            <option value="psychologist">Psicologia</option>

            <option value="doctor">Medicina</option>

            <option value="physiotherapist">Fisioterapia</option>
          </select>
        </label>
      </div>

      <label className={styles.idsField}>
        <span>Identificadores</span>

        <input
          type="text"
          value={ids}
          placeholder="IDs separados por vírgula"
          aria-label="Identificadores"
          onChange={(event) => {
            setIds(event.target.value);
          }}
        />

        <small>
          Use este campo somente quando precisar consultar profissionais
          específicos.
        </small>
      </label>

      <div className={styles.filterActions}>
        <button type="submit" className={styles.primaryButton}>
          Aplicar filtros
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleClear}
        >
          Limpar filtros
        </button>
      </div>
    </form>
  );
}
