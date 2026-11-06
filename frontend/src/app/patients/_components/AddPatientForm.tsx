'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  createPatient,
  type AccountOption,
  type SupportContact,
} from '@/lib/patients';
import styles from '../patients.module.css';
import AccountCombobox from './AccountCombobox';
import SupportContactFields from './SupportContactFields';
import SupportContactList from './SupportContactList';

const SUBMIT_ERROR = 'Não foi possível adicionar o paciente.';

type AddPatientFormProps = {
  onCancel: () => void;
  onAdded: (name: string) => void;
};

export default function AddPatientForm({
  onCancel,
  onAdded,
}: AddPatientFormProps) {
  const router = useRouter();

  const [account, setAccount] = useState<AccountOption | null>(null);
  const [accountError, setAccountError] = useState('');
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

    if (!account) {
      setAccountError('Selecione a conta.');
      document.getElementById('account')?.focus();
      return;
    }

    setSubmitting(true);

    try {
      await createPatient({ accountId: account.id, supportContacts: contacts });
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

    onAdded(account.name);
  }

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
            Conta já cadastrada que passa a ser paciente. Busque por nome ou
            e-mail. Contas que já são pacientes ou profissionais não aparecem.
          </HelpTooltip>
        </div>

        <AccountCombobox
          id="account"
          value={account}
          disabled={submitting}
          invalid={Boolean(accountError)}
          describedBy={
            accountError ? 'account-help account-error' : 'account-help'
          }
          onChange={(next) => {
            setAccount(next);
            setAccountError('');
          }}
        />

        {accountError && (
          <p id="account-error" className={ui.fieldError}>
            {accountError}
          </p>
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
