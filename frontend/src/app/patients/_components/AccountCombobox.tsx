'use client';

import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  getAccountsWithoutProfile,
  type AccountOption,
  type AccountsResponse,
} from '@/lib/patients';
import styles from '../patients.module.css';

const LOAD_ERROR = 'Não foi possível carregar as contas.';

type AccountComboboxProps = {
  id: string;
  value: AccountOption | null;
  onChange: (account: AccountOption | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

// Combobox ARIA (NFUS002) do campo "Conta": busca no servidor por nome ou
// e-mail (NFUS003) entre as contas sem perfil de paciente nem profissional.
export default function AccountCombobox({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: AccountComboboxProps) {
  const router = useRouter();
  const listId = useId();

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
    response: AccountsResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getAccountsWithoutProfile({ q: term, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setLast({ key, term, response });
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

  const loading = failure?.key !== key && last?.key !== key;
  const options = last?.response.data ?? [];
  const active = Math.min(activeIndex, options.length - 1);
  const hasFailed = failure?.key === key;
  const showClear = value !== null || search.input !== '';

  function optionId(index: number) {
    return `${listId}-option-${index}`;
  }

  function select(account: AccountOption) {
    onChange(account);
    setOpen(false);
    setActiveIndex(-1);
  }

  function clearAll() {
    onChange(null);
    search.clear();
    setActiveIndex(-1);
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
        // fechada, deixa o formulário enviar.
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
        // 1º Esc fecha a lista; o 2º limpa. Sem nada a limpar, o Esc segue
        // e fecha o modal.
        if (open) {
          event.preventDefault();
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
    : !last
      ? 'Carregando contas...'
      : options.length === 0 && !loading
        ? last.term
          ? `Nenhuma conta encontrada para “${last.term}”.`
          : 'Nenhuma conta disponível.'
        : loading
          ? 'Buscando contas...'
          : null;

  const failureMessage =
    failure?.error instanceof ApiError && failure.error.apiMessage
      ? failure.error.apiMessage
      : LOAD_ERROR;

  return (
    <div className={styles.combobox}>
      <div className={styles.search}>
        <input
          id={id}
          type="text"
          role="combobox"
          className={`${ui.input} ${styles.comboboxInput}`}
          autoComplete="off"
          placeholder="Busque por nome ou e-mail"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 ? optionId(active) : undefined
          }
          aria-invalid={invalid ? true : undefined}
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
            className={`${ui.iconButton} ${styles.searchClear}`}
            aria-label="Limpar campo da conta"
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

      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Contas disponíveis"
          aria-busy={loading}
          className={`${styles.listbox} ${loading ? styles.refreshing : ''}`}
        >
          {options.map((account, index) => (
            <li
              key={account.id}
              id={optionId(index)}
              role="option"
              aria-selected={value?.id === account.id}
              data-active={index === active ? true : undefined}
              className={styles.option}
              // Mantém o foco no campo ao clicar na opção.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(account)}
            >
              {account.name} · {account.email}
            </li>
          ))}
        </ul>
      )}

      {open && message && (
        <div className={styles.comboboxStatus} role="status" aria-live="polite">
          <p>{message}</p>

          {last?.term && options.length === 0 && !loading && (
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => search.clear()}
            >
              Limpar busca
            </button>
          )}
        </div>
      )}

      {hasFailed && (
        <div
          className={`${ui.alert} ${ui.alertError} ${styles.loadError}`}
          role="alert"
        >
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <div>
            <span>{failureMessage}</span>

            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary} ${styles.retry}`}
              onClick={() => {
                setFailure(null);
                setRetryKey((current) => current + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
