'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { changePassword } from '@/lib/account';
import patientStyles from '@/app/patients/patients.module.css';
import signupStyles from '@/app/signup/signup.module.css';
import styles from '../profile.module.css';

type ChangePasswordFormProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

type PasswordErrors = {
  current: string;
  next: string;
  confirmation: string;
  form: string;
};

const GENERIC_ERROR =
  'Não foi possível redefinir sua senha. Tente novamente mais tarde.';
const PASSWORD_REQUIREMENTS_ERROR =
  'A senha precisa ter pelo menos 8 caracteres e conter um número.';

export default function ChangePasswordForm({
  onCancel,
  onSuccess,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<PasswordErrors>({
    current: '',
    next: '',
    confirmation: '',
    form: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const passwordHasMinLength = newPassword.length >= 8;
  const passwordHasNumber = /\d/.test(newPassword);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function validate() {
    const nextErrors: PasswordErrors = {
      current: currentPassword ? '' : 'Informe sua senha atual.',
      next: newPassword ? '' : 'Informe sua nova senha.',
      confirmation: confirmation ? '' : 'Confirme sua nova senha.',
      form: '',
    };

    if (!nextErrors.confirmation && newPassword !== confirmation) {
      nextErrors.confirmation = 'A confirmação deve ser igual à nova senha.';
    }

    if (!nextErrors.next && (!passwordHasMinLength || !passwordHasNumber)) {
      nextErrors.next = PASSWORD_REQUIREMENTS_ERROR;
    }

    setErrors(nextErrors);

    if (nextErrors.current) {
      currentRef.current?.focus();
    } else if (nextErrors.next) {
      document.getElementById('new-password')?.focus();
    } else if (nextErrors.confirmation) {
      document.getElementById('confirm-password')?.focus();
    }

    return !nextErrors.current && !nextErrors.next && !nextErrors.confirmation;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !validate()) {
      return;
    }

    setSubmitting(true);
    setErrors({ current: '', next: '', confirmation: '', form: '' });

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      const apiMessage =
        error instanceof ApiError ? (error.apiMessage ?? '') : '';

      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.code === 'INVALID_CURRENT_PASSWORD'
      ) {
        setErrors((current) => ({
          ...current,
          current: apiMessage || GENERIC_ERROR,
        }));
        currentRef.current?.focus();
      } else if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.code === 'VALIDATION_ERROR'
      ) {
        setErrors((current) => ({
          ...current,
          next: apiMessage || GENERIC_ERROR,
        }));
        document.getElementById('new-password')?.focus();
      } else {
        setErrors((current) => ({
          ...current,
          form: apiMessage || GENERIC_ERROR,
        }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(id: keyof PasswordErrors) {
    return errors[id] ? (
      <p id={`${id}-password-error`} className={ui.fieldError} role="alert">
        {errors[id]}
      </p>
    ) : null;
  }

  return (
    <dialog
      ref={dialogRef}
      className={patientStyles.dialog}
      aria-labelledby="password-title"
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === dialogRef.current && !submitting) {
          onCancel();
        }
      }}
    >
      <button
        type="button"
        className={`${patientStyles.iconButton} ${patientStyles.dialogClose}`}
        aria-label="Fechar janela"
        onClick={onCancel}
        disabled={submitting}
      >
        <Icon name="close" className={ui.icon} />
      </button>

      <h2 id="password-title">Redefinir senha</h2>
      <p className={styles.passwordIntro}>
        Informe sua senha atual e escolha uma nova senha para sua conta.
      </p>

      {errors.form && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>
          <span>{errors.form}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.passwordFields}>
          <div className={ui.field}>
            <label htmlFor="current-password" className={ui.label}>
              Senha atual
            </label>
            <div className={signupStyles.passwordWrapper}>
              <input
                ref={currentRef}
                id="current-password"
                name="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={ui.input}
                value={currentPassword}
                disabled={submitting}
                aria-invalid={errors.current ? 'true' : 'false'}
                aria-describedby={
                  errors.current ? 'current-password-error' : undefined
                }
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    current: '',
                    form: '',
                  }));
                }}
              />
              <button
                type="button"
                className={signupStyles.revealButton}
                aria-label={
                  showCurrentPassword
                    ? 'Ocultar senha atual'
                    : 'Mostrar senha atual'
                }
                aria-pressed={showCurrentPassword}
                onClick={() => setShowCurrentPassword((current) => !current)}
              >
                <Icon name={showCurrentPassword ? 'eye' : 'eyeClosed'} />
              </button>
            </div>
            {fieldError('current')}
          </div>

          <div className={ui.field}>
            <label htmlFor="new-password" className={ui.label}>
              Nova senha
            </label>
            <div className={signupStyles.passwordWrapper}>
              <input
                id="new-password"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className={ui.input}
                value={newPassword}
                disabled={submitting}
                aria-invalid={errors.next ? 'true' : 'false'}
                aria-describedby={
                  errors.next ? 'next-password-error' : undefined
                }
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    next: '',
                    form: '',
                  }));
                }}
              />
              <button
                type="button"
                className={signupStyles.revealButton}
                aria-label={
                  showNewPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'
                }
                aria-pressed={showNewPassword}
                onClick={() => setShowNewPassword((current) => !current)}
              >
                <Icon name={showNewPassword ? 'eye' : 'eyeClosed'} />
              </button>
            </div>
            {fieldError('next')}
          </div>

          <div className={ui.field}>
            <label htmlFor="confirm-password" className={ui.label}>
              Confirmar nova senha
            </label>
            <div className={signupStyles.passwordWrapper}>
              <input
                id="confirm-password"
                name="confirmation"
                type={showConfirmation ? 'text' : 'password'}
                autoComplete="new-password"
                className={ui.input}
                value={confirmation}
                disabled={submitting}
                aria-invalid={errors.confirmation ? 'true' : 'false'}
                aria-describedby={
                  errors.confirmation
                    ? 'confirmation-password-error'
                    : undefined
                }
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    confirmation: '',
                    form: '',
                  }));
                }}
              />
              <button
                type="button"
                className={signupStyles.revealButton}
                aria-label={
                  showConfirmation
                    ? 'Ocultar confirmação da senha'
                    : 'Mostrar confirmação da senha'
                }
                aria-pressed={showConfirmation}
                onClick={() => setShowConfirmation((current) => !current)}
              >
                <Icon name={showConfirmation ? 'eye' : 'eyeClosed'} />
              </button>
            </div>
            {fieldError('confirmation')}
          </div>
        </div>

        <div
          className={`${signupStyles.requirements} ${styles.passwordRequirements}`}
        >
          <p className={signupStyles.requirementsTitle}>Requisitos da senha</p>
          <ul>
            <li
              className={
                passwordHasMinLength
                  ? signupStyles.requirementMet
                  : newPassword
                    ? signupStyles.requirementMissing
                    : ''
              }
            >
              <span aria-hidden="true">{passwordHasMinLength ? '✓' : '•'}</span>{' '}
              Oito caracteres ou mais
            </li>
            <li
              className={
                passwordHasNumber
                  ? signupStyles.requirementMet
                  : newPassword
                    ? signupStyles.requirementMissing
                    : ''
              }
            >
              <span aria-hidden="true">{passwordHasNumber ? '✓' : '•'}</span>{' '}
              Pelo menos um número
            </li>
          </ul>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`${ui.btn} ${ui.btnPrimary}`}
            disabled={submitting}
          >
            {submitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
