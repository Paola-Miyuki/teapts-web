'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import styles from '../proposals.module.css';

export type ProposalFilters = {
  search: string;
};

type PtsProposalFiltersProps = {
  filters: ProposalFilters;
  onApply: (filters: ProposalFilters) => void;
  onClear: () => void;
};

export default function PtsProposalFilters({
  filters,
  onApply,
  onClear,
}: PtsProposalFiltersProps) {
  const [search, setSearch] = useState(filters.search);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({ search: search.trim() });
  }

  function handleClear() {
    setSearch('');
    onClear();
  }

  return (
    <form className={`${ui.card} ${styles.filters}`} onSubmit={handleSubmit}>
      <div className={styles.filterMain}>
        <label className={ui.field} style={{ flex: 1 }}>
          <span className={ui.label}>Buscar paciente</span>

          <div className={styles.inputWithIcon}>
            <Icon name="search" className={styles.searchIcon} />

            <input
              className={ui.input}
              type="search"
              value={search}
              placeholder="Digite o nome do paciente..."
              aria-label="Buscar paciente"
              style={{ paddingLeft: '38px' }}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </label>

        <div className={styles.filterActions}>
          <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>
            Buscar
          </button>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={handleClear}
          >
            Limpar
          </button>
        </div>
      </div>
    </form>
  );
}
