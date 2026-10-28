'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { ProfessionalSpecialism } from '@/lib/professionals';
import type { Filters } from './Professionals';
import styles from '../professionals.module.css';

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
    <form className={`${ui.card} ${styles.filters}`} onSubmit={handleSubmit}>
      <div className={styles.filterMain}>
        <label className={ui.field}>
          <span className={ui.label}>Nome</span>

          <div className={styles.inputWithIcon}>
            <Icon name="search" className={styles.searchIcon} />

            <input
              className={ui.input}
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

        <label className={ui.field}>
          <span className={ui.label}>Especialidade</span>

          <select
            className={ui.input}
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

      <label className={`${ui.field} ${styles.idsField}`}>
        <span className={ui.label}>Identificadores</span>

        <input
          className={ui.input}
          type="text"
          value={ids}
          placeholder="IDs separados por vírgula"
          aria-label="Identificadores"
          onChange={(event) => {
            setIds(event.target.value);
          }}
        />

        <small className={ui.hint}>
          Use este campo somente quando precisar consultar profissionais
          específicos.
        </small>
      </label>

      <div className={styles.filterActions}>
        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>
          Aplicar filtros
        </button>

        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={handleClear}
        >
          Limpar filtros
        </button>
      </div>
    </form>
  );
}
