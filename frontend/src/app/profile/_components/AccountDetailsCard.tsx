'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { can } from '@/lib/permissions';
import {
  ROLE_LABELS,
  updateMe,
  type Account,
  type ProfileKind,
} from '@/lib/account';
import styles from '../profile.module.css';

type AccountDetailsCardProps = {
  account: Account;
  kind: ProfileKind;
  onAccountUpdated: (account: Account) => void;
  onFeedback: (message: string) => void;
  onResetPassword: () => void;
};

type FieldErrors = {
  name: string;
  email: string;
  form: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMIT_ERROR =
  'Não foi possível atualizar seus dados. Tente novamente mais tarde.';

export default function AccountDetailsCard({
  account,
  kind,
  onAccountUpdated,
  onFeedback,
  onResetPassword,
}: AccountDetailsCardProps) {
  const router = useRouter();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [errors, setErrors] = useState<FieldErrors>({
    name: '',
    email: '',
    form: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const canUpdate = can(account, 'updateOwnAccount');
  const canChangePassword = can(account, 'changeOwnPassword');

  useEffect(() => {
    if (editing) {
      firstFieldRef.current?.focus();
    }
  }, [editing]);

  function startEditing() {
    setName(account.name);
    setEmail(account.email);
    setErrors({ name: '', email: '', form: '' });
    setEditing(true);
  }

  function cancelEditing() {
    setName(account.name);
    setEmail(account.email);
    setErrors({ name: '', email: '', form: '' });
    setEditing(false);
  }

  function validate() {
    const nextErrors: FieldErrors = { name: '', email: '', form: '' };
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      nextErrors.name = 'Informe seu nome completo.';
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Informe um e-mail válido, como nome@exemplo.com.';
    }

    setErrors(nextErrors);

    if (nextErrors.name) {
      firstFieldRef.current?.focus();
    } else if (nextErrors.email) {
      document.getElementById('profile-email')?.focus();
    }

    return !nextErrors.name && !nextErrors.email;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !validate()) {
      return;
    }

    const nextName = name.trim();
    const nextEmail = email.trim();
    const input: { name?: string; email?: string } = {};

    if (nextName !== account.name) {
      input.name = nextName;
    }

    if (nextEmail.toLowerCase() !== account.email) {
      input.email = nextEmail;
    }

    if (Object.keys(input).length === 0) {
      setEditing(false);
      return;
    }

    setSubmitting(true);
    setErrors({ name: '', email: '', form: '' });

    try {
      const updatedAccount = await updateMe(input);
      onAccountUpdated(updatedAccount);
      setName(updatedAccount.name);
      setEmail(updatedAccount.email);
      setEditing(false);
      onFeedback('Seus dados foram atualizados com sucesso.');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      const apiMessage =
        error instanceof ApiError ? (error.apiMessage ?? '') : '';

      if (error instanceof ApiError && error.status === 409) {
        setErrors((current) => ({ ...current, email: apiMessage }));
        document.getElementById('profile-email')?.focus();
      } else if (error instanceof ApiError && error.status === 400) {
        const message = apiMessage || SUBMIT_ERROR;

        if (input.email) {
          setErrors((current) => ({ ...current, email: message }));
          document.getElementById('profile-email')?.focus();
        } else if (input.name) {
          setErrors((current) => ({ ...current, name: message }));
          firstFieldRef.current?.focus();
        }
      } else {
        setErrors((current) => ({
          ...current,
          form: apiMessage || SUBMIT_ERROR,
        }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className={`${ui.card} ${styles.card}`}>
      <div className={styles.personBanner}>
        <span className={styles.avatar} aria-hidden="true">
          {account.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('')}
        </span>
        <div>
          <h2>{account.name}</h2>
          <p>{ROLE_LABELS[kind]}</p>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} noValidate>
          {errors.form && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
                <Icon name="alertCircle" />
              </div>
              <span>{errors.form}</span>
            </div>
          )}

          <div className={styles.detailsEdit}>
            <div className={ui.field}>
              <label htmlFor="profile-name" className={ui.label}>
                Nome completo
              </label>
              <input
                ref={firstFieldRef}
                id="profile-name"
                name="name"
                className={ui.input}
                value={name}
                disabled={submitting}
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={
                  errors.name ? 'profile-name-error' : undefined
                }
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((current) => ({ ...current, name: '', form: '' }));
                }}
              />
              {errors.name && (
                <p
                  id="profile-name-error"
                  className={ui.fieldError}
                  role="alert"
                >
                  {errors.name}
                </p>
              )}
            </div>

            <div className={ui.field}>
              <label htmlFor="profile-email" className={ui.label}>
                E-mail
              </label>
              <input
                id="profile-email"
                name="email"
                type="email"
                className={ui.input}
                value={email}
                disabled={submitting}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={
                  errors.email ? 'profile-email-error' : undefined
                }
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((current) => ({ ...current, email: '', form: '' }));
                }}
              />
              {errors.email && (
                <p
                  id="profile-email-error"
                  className={ui.fieldError}
                  role="alert"
                >
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={cancelEditing}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className={styles.details}>
            <div>
              <dt>Nome completo</dt>
              <dd>{account.name}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{account.email || 'Não informado'}</dd>
            </div>
          </dl>

          <p className={styles.note}>
            As permissões de acesso dependem dos perfis e dos vínculos
            autorizados para a sua conta.
          </p>

          <div className={styles.actions}>
            {canUpdate && (
              <button
                type="button"
                className={`${ui.btn} ${ui.btnSecondary}`}
                onClick={startEditing}
              >
                Editar
              </button>
            )}
            {canChangePassword && (
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={onResetPassword}
              >
                <Icon name="lock" className={ui.icon} />
                Redefinir senha
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
