'use client';

import type { KeyboardEvent } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import styles from '../patients.module.css';

type PatientSearchProps = {
  value: string;
  isTooShort: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onClear: () => void;
};

export default function PatientSearch({
  value,
  isTooShort,
  onChange,
  onCommit,
  onClear,
}: PatientSearchProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit();
    } else if (event.key === 'Escape' && value !== '') {
      event.preventDefault();
      onClear();
    }
  }

  return (
    <div className={styles.searchBlock} role="search">
      <div className={styles.search}>
        <Icon name="search" className={styles.searchIcon} />

        <input
          id="patient-search"
          type="search"
          className={`${ui.input} ${styles.searchInput}`}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          aria-describedby={isTooShort ? 'patient-search-hint' : undefined}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        {value !== '' && (
          <button
            type="button"
            className={`${ui.iconButton} ${styles.searchClear}`}
            aria-label="Limpar campo de busca"
            onClick={onClear}
          >
            <Icon name="close" className={ui.icon} />
          </button>
        )}
      </div>

      {isTooShort && (
        <p id="patient-search-hint" className={ui.hint} role="status">
          Digite ao menos 2 caracteres para buscar.
        </p>
      )}
    </div>
  );
}
