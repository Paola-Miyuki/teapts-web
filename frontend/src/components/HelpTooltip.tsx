'use client';

import { useState, type KeyboardEvent } from 'react';

import Icon from './Icon';
import styles from './HelpTooltip.module.css';

type HelpTooltipProps = {
  // Use o mesmo id no aria-describedby do campo, para o leitor de tela ler o
  // texto junto com o campo.
  id: string;
  label: string;
  children: string;
};

// Botão (?) com um texto de ajuda. Abre ao passar o mouse, ao focar ou ao
// clicar (toque no celular); o Esc fecha sem fechar o modal em volta.
export default function HelpTooltip({ id, label, children }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <span className={styles.wrapper} data-open={open || undefined}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Ajuda: ${label}`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      >
        <Icon name="help" className={styles.icon} />
      </button>

      <span id={id} role="tooltip" className={styles.bubble}>
        {children}
      </span>
    </span>
  );
}
