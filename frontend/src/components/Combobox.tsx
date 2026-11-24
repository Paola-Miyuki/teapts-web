'use client';

import { useId, useState, type KeyboardEvent } from 'react';

import styles from './Combobox.module.css';

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  id: string;
  options: ComboboxOption[];
  // Texto do campo; com `onInputChange` a busca é feita fora (no servidor).
  input: string;
  onInputChange: (text: string) => void;
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  emptyText: string;
  listLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
};

// Combobox ARIA (NFUS002) dos mockups (`pat-combobox`): lista abre ao focar ou
// digitar; setas, Enter e Esc navegam, escolhem e fecham.
export default function Combobox({
  id,
  options,
  input,
  onInputChange,
  onSelect,
  placeholder,
  emptyText,
  listLabel,
  disabled,
  invalid,
  required,
  describedBy,
}: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  function choose(option: ComboboxOption) {
    onSelect(option);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  const activeId =
    open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined;

  return (
    <div className={styles.combobox}>
      <input
        id={id}
        type="text"
        role="combobox"
        className="input"
        autoComplete="off"
        value={input}
        placeholder={placeholder}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid ? 'true' : 'false'}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          onInputChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
      />

      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        className={styles.listbox}
        hidden={!open || options.length === 0}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            data-active={index === activeIndex || undefined}
            className={styles.option}
            // mousedown antes do blur do campo, para a escolha valer.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(option);
            }}
          >
            {option.label}
          </li>
        ))}
      </ul>

      {open && options.length === 0 && (
        <div className={styles.status} role="status" aria-live="polite">
          <p>{emptyText}</p>
        </div>
      )}
    </div>
  );
}
