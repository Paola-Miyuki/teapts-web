'use client';

import type { KeyboardEvent } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import styles from '../patients.module.css';

type PatientSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onClear: () => void;
  // Rótulo e texto de apoio do campo (padrão: nome ou e-mail, do admin).
  label?: string;
};

export default function PatientSearch({
  value,
  onChange,
  onCommit,
  onClear,
  label = 'Buscar por nome ou e-mail',
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
          placeholder={label}
          aria-label={label}
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
    </div>
  );
}
