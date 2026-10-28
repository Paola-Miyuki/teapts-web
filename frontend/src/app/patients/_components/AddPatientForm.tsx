'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  createPatient,
  getAccountsWithoutPatientProfile,
  type AccountOption,
  type SupportContact,
} from '@/lib/patients';
import styles from '../patients.module.css';
import SupportContactFields from './SupportContactFields';
import SupportContactList from './SupportContactList';

const LOAD_ERROR = 'Não foi possível carregar as contas.';
const SUBMIT_ERROR = 'Não foi possível adicionar o paciente.';

function getAccountPlaceholder(accounts: AccountOption[] | null) {
  if (accounts === null) {
    return 'Carregando contas...';
  }

  if (accounts.length === 0) {
    return 'Nenhuma conta disponível.';
  }

  return 'Selecione a conta';
}

type AddPatientFormProps = {
  onCancel: () => void;
  onAdded: (name: string) => void;
};

export default function AddPatientForm({
  onCancel,
  onAdded,
}: AddPatientFormProps) {
  const router = useRouter();

  // null = carregando; o select só tem a 1ª página (20 contas).
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const [accountId, setAccountId] = useState('');
  const [accountError, setAccountError] = useState('');
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;

    getAccountsWithoutPatientProfile()
      .then((result) => {
        if (!cancelled) {
          setAccounts(result.data);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setAccounts([]);
        setLoadError(LOAD_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey, router]);

  function handleRetry() {
    setAccounts(null);
    setLoadError('');
    setRetryKey((current) => current + 1);
  }

  function handleSaveContact(contact: SupportContact) {
    setContacts((current) => [...current, contact]);
    setIsContactOpen(false);
  }

  function handleRemoveContact(index: number) {
    setContacts((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitError('');

    if (!accountId) {
      setAccountError('Selecione a conta.');
      document.getElementById('account')?.focus();
      return;
    }

    setSubmitting(true);

    try {
      await createPatient({ accountId, supportContacts: contacts });
    } catch (error) {
      setSubmitting(false);

      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      setSubmitError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : SUBMIT_ERROR,
      );
      return;
    }

    const name = accounts?.find((account) => account.id === accountId)?.name;

    onAdded(name ?? 'da conta selecionada');
  }

  const isAccountDisabled =
    accounts === null || accounts.length === 0 || submitting;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {submitError && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <span>{submitError}</span>
        </div>
      )}

      <div className={`${ui.field} ${styles.field}`}>
        <div className={styles.labelRow}>
          <label htmlFor="account" className={ui.label}>
            Conta
          </label>

          <HelpTooltip id="account-help" label="Conta">
            Conta já cadastrada que passa a ser paciente. Contas que já são
            pacientes não aparecem.
          </HelpTooltip>
        </div>

        <select
          id="account"
          name="account"
          className={ui.input}
          value={accountId}
          disabled={isAccountDisabled}
          aria-invalid={accountError ? true : undefined}
          aria-describedby={
            accountError ? 'account-help account-error' : 'account-help'
          }
          onChange={(event) => {
            setAccountId(event.target.value);
            setAccountError('');
          }}
        >
          <option value="">{getAccountPlaceholder(accounts)}</option>

          {accounts?.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        {accountError && (
          <p id="account-error" className={ui.fieldError}>
            {accountError}
          </p>
        )}

        {loadError && (
          <div
            className={`${ui.alert} ${ui.alertError} ${styles.loadError}`}
            role="alert"
          >
            <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
              <Icon name="alertCircle" />
            </div>

            <div>
              <span>{loadError}</span>

              <button
                type="button"
                className={`${ui.btn} ${ui.btnSecondary} ${styles.retry}`}
                onClick={handleRetry}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </div>

      <fieldset className={styles.contacts} aria-describedby="contacts-help">
        <legend className={`${ui.label} ${styles.labelRow}`}>
          <span>
            Contatos de suporte{' '}
            <span className={styles.optional}>(opcional)</span>
          </span>

          <HelpTooltip id="contacts-help" label="Contatos de suporte">
            Pessoas que ajudam no cuidado. Um contato de suporte não é
            responsável tutelar e não acessa informações clínicas.
          </HelpTooltip>
        </legend>

        <SupportContactList
          contacts={contacts}
          onRemove={handleRemoveContact}
        />

        {isContactOpen ? (
          <SupportContactFields
            onCancel={() => setIsContactOpen(false)}
            onSave={handleSaveContact}
          />
        ) : (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary} ${styles.addContact}`}
            onClick={() => setIsContactOpen(true)}
          >
            <Icon name="plus" className={ui.icon} />
            Adicionar contato
          </button>
        )}
      </fieldset>

      <div className={styles.formActions}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className={`${ui.btn} ${ui.btnPrimary}`}
          disabled={submitting}
        >
          {submitting ? 'Adicionando...' : 'Adicionar paciente'}
        </button>
      </div>
    </form>
  );
}
