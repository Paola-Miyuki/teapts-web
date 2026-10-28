'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  createPatient,
  getAccountsWithoutPatientProfile,
  type AccountOption,
  type SupportContact,
} from '@/lib/patients';
import styles from '../new.module.css';
import SupportContactList from './SupportContactList';
import SupportContactModal from './SupportContactModal';

const LOAD_ERROR = 'Não foi possível carregar as contas.';
const SUBMIT_ERROR = 'Não foi possível criar o perfil de paciente.';

function getAccountPlaceholder(accounts: AccountOption[] | null) {
  if (accounts === null) {
    return 'Carregando contas...';
  }

  if (accounts.length === 0) {
    return 'Nenhuma conta sem perfil de paciente.';
  }

  return 'Selecione a conta';
}

export default function CreatePatientForm() {
  const router = useRouter();
  const accountRef = useRef<HTMLSelectElement>(null);

  // null = carregando; o select só tem a 1ª página (20 contas).
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const [accountId, setAccountId] = useState('');
  const [accountError, setAccountError] = useState('');
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');

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

  function handleAccountChange(value: string) {
    setAccountId(value);
    setAccountError('');
  }

  function handleAddContact(contact: SupportContact) {
    setContacts((current) => [...current, contact]);
    setIsModalOpen(false);
  }

  function handleRemoveContact(index: number) {
    setContacts((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitError('');
    setSuccess('');

    if (!accountId) {
      setAccountError('Selecione a conta.');
      accountRef.current?.focus();
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

    setAccounts(
      (current) =>
        current?.filter((account) => account.id !== accountId) ?? current,
    );
    setAccountId('');
    setContacts([]);
    setSubmitting(false);
    setSuccess(`Perfil de paciente criado para ${name ?? 'a conta'}.`);
  }

  const isAccountDisabled =
    accounts === null || accounts.length === 0 || submitting;

  return (
    <>
      <div className={styles.formGrid}>
        <form className={styles.formPanel} onSubmit={handleSubmit} noValidate>
          <h2>Dados do paciente</h2>

          <p className={styles.panelIntro}>
            Contas que já possuem um perfil não aparecem nesta lista.
          </p>

          {success && (
            <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
              <div className={ui.alertIcon}>
                <Icon name="checkCircle" />
              </div>

              <span>{success}</span>
            </div>
          )}

          {submitError && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
                <Icon name="alertCircle" />
              </div>

              <span>{submitError}</span>
            </div>
          )}

          <div className={`${ui.field} ${styles.field}`}>
            <label htmlFor="account" className={ui.label}>
              Conta
            </label>

            <select
              ref={accountRef}
              id="account"
              name="account"
              className={ui.input}
              value={accountId}
              disabled={isAccountDisabled}
              aria-invalid={accountError ? true : undefined}
              aria-describedby={
                accountError ? 'account-help account-error' : 'account-help'
              }
              onChange={(event) => handleAccountChange(event.target.value)}
            >
              <option value="">{getAccountPlaceholder(accounts)}</option>

              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <small id="account-help" className={ui.hint}>
              Selecione a conta à qual o perfil de paciente será associado.
            </small>

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

          <hr className={styles.rule} />

          <h2>Contatos de suporte</h2>

          <p className={styles.panelIntro}>
            Opcional · pessoas que ajudam no cuidado.
          </p>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary} ${styles.addContact}`}
            onClick={() => setIsModalOpen(true)}
          >
            <Icon name="plus" className={ui.icon} />
            Adicionar contato
          </button>

          <SupportContactList
            contacts={contacts}
            onRemove={handleRemoveContact}
          />

          <div className={styles.formActions}>
            <button
              type="submit"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={submitting}
            >
              {submitting ? 'Criando perfil...' : 'Criar perfil de paciente'}
            </button>

            <Link href="/home" className={`${ui.btn} ${ui.btnSecondary}`}>
              Cancelar
            </Link>
          </div>
        </form>

        <aside className={styles.asidePanel}>
          <h2>Uma rede de apoio</h2>

          <p>
            Você pode adicionar nome, descrição, e-mail e telefone de cada
            contato.
          </p>

          <p>
            Um contato de suporte não é, por si só, um responsável tutelar e não
            recebe acesso às informações clínicas.
          </p>

          <hr className={styles.rule} />

          <p>
            O cadastro do perfil é uma operação administrativa. O acompanhamento
            clínico depende do vínculo com a equipe.
          </p>
        </aside>
      </div>

      <SupportContactModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddContact}
      />
    </>
  );
}
