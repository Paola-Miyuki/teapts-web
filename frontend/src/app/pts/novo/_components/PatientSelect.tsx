'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import comboboxStyles from '@/components/Combobox.module.css';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { listEligiblePatients } from '../api/ptsApi';
import { ApiError } from '../api/http';
import type { EligiblePatient } from '../types';
import styles from './PatientSelect.module.css';

const LOAD_ERROR = 'Não foi possível carregar os pacientes.';
const FORBIDDEN_ERROR = 'Acesso restrito a profissionais.';

type PatientSelectProps = {
  id: string;
  value: EligiblePatient | null;
  onChange: (patient: EligiblePatient | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return FORBIDDEN_ERROR;
    }

    if (error.apiMessage) {
      return error.apiMessage;
    }
  }

  return LOAD_ERROR;
}

// Combobox ARIA (NFUS002) do passo "Paciente": busca no servidor, só entre os
// pacientes elegíveis (RN011), por nome, nome social, e-mail ou CPF (NFUS003).
// Cada sugestão mostra o nome e o e-mail; o CPF não aparece (DP011).
export default function PatientSelect({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: PatientSelectProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useDebouncedSearch();
  const { term } = search;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryKey, setRetryKey] = useState(0);

  // A resposta e o erro guardam a chave da consulta de origem: os resultados
  // anteriores ficam na lista enquanto a nova busca carrega.
  const key = `${term}\n${retryKey}`;
  const [last, setLast] = useState<{
    key: string;
    term: string;
    patients: EligiblePatient[];
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    // Abaixo de 2 caracteres não há busca: o servidor não é chamado.
    if (term === '') {
      return;
    }

    const controller = new AbortController();

    listEligiblePatients({ q: term, signal: controller.signal })
      .then((patients) => {
        if (!controller.signal.aborted) {
          setLast({ key, term, patients });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setFailure({ key, error });
      });

    return () => controller.abort();
  }, [key, router, term]);

  const searching = term !== '';
  const loading = searching && failure?.key !== key && last?.key !== key;
  const hasFailed = searching && failure?.key === key;
  const options = searching ? (last?.patients ?? []) : [];
  const active = Math.min(activeIndex, options.length - 1);
  const showClear = value !== null || search.input !== '';

  function optionId(index: number) {
    return `${listId}-option-${index}`;
  }

  function select(patient: EligiblePatient) {
    onChange(patient);
    setOpen(false);
    setActiveIndex(-1);
  }

  function clearAll() {
    onChange(null);
    search.clear();
    setActiveIndex(-1);
    inputRef.current?.focus();
    setOpen(true);
  }

  function handleChange(text: string) {
    if (value) {
      onChange(null);
    }

    search.setInput(text);
    setOpen(true);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActiveIndex(
          options.length === 0 ? -1 : (active + 1) % options.length,
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setOpen(true);
        setActiveIndex(
          options.length === 0
            ? -1
            : active <= 0
              ? options.length - 1
              : active - 1,
        );
        break;

      case 'Enter':
        // Com a lista aberta, Enter escolhe a opção ativa ou busca na hora;
        // fechada, deixa o formulário seguir.
        if (open) {
          event.preventDefault();

          if (active >= 0) {
            select(options[active]);
          } else {
            search.commit();
          }
        }
        break;

      case 'Escape':
        // 1º Esc fecha a lista; o 2º limpa o campo.
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActiveIndex(-1);
        } else if (showClear) {
          event.preventDefault();
          clearAll();
        }
        break;
    }
  }

  const message = hasFailed
    ? null
    : !searching
      ? 'Digite ao menos 2 caracteres para buscar o paciente.'
      : loading && !last
        ? 'Buscando pacientes...'
        : options.length === 0 && !loading
          ? 'Nenhum paciente elegível encontrado. Pacientes com PTS ativo ou rascunho não aparecem aqui.'
          : null;

  return (
    <div className={comboboxStyles.combobox}>
      <div className={styles.search}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          className={`input ${styles.input}`}
          autoComplete="off"
          placeholder="Busque por nome, e-mail ou CPF"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 ? optionId(active) : undefined
          }
          aria-invalid={invalid ? 'true' : 'false'}
          aria-required="true"
          aria-describedby={
            [describedBy, search.isTooShort ? `${id}-hint` : '']
              .filter(Boolean)
              .join(' ') || undefined
          }
          disabled={disabled}
          value={value ? `${value.name} · ${value.email}` : search.input}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />

        {showClear && !disabled && (
          <button
            type="button"
            className={`${ui.iconButton} ${styles.clear}`}
            aria-label="Limpar campo do paciente"
            onClick={clearAll}
          >
            <Icon name="close" className={ui.icon} />
          </button>
        )}
      </div>

      {search.isTooShort && (
        <p id={`${id}-hint`} className={ui.hint} role="status">
          Digite ao menos 2 caracteres para buscar.
        </p>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label="Pacientes elegíveis"
        aria-busy={loading}
        className={`${comboboxStyles.listbox} ${loading ? styles.refreshing : ''}`}
        hidden={!open || options.length === 0}
      >
        {options.map((patient, index) => (
          <li
            key={patient.id}
            id={optionId(index)}
            role="option"
            aria-selected={value?.id === patient.id}
            data-active={index === active ? true : undefined}
            className={comboboxStyles.option}
            // Mantém o foco no campo ao clicar na opção.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select(patient)}
          >
            {patient.name} · {patient.email}
          </li>
        ))}
      </ul>

      {open && message && (
        <div className={comboboxStyles.status} role="status" aria-live="polite">
          <p>{message}</p>
        </div>
      )}

      {hasFailed && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <div>
            <span>{failureMessage(failure?.error)}</span>

            {!(
              failure?.error instanceof ApiError && failure.error.status === 403
            ) && (
              <button
                type="button"
                className={`${ui.btn} ${ui.btnSecondary} ${styles.retry}`}
                onClick={() => {
                  setFailure(null);
                  setRetryKey((current) => current + 1);
                  // O clique no botão tirou o foco do campo e fechou a lista.
                  inputRef.current?.focus();
                  setOpen(true);
                }}
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
