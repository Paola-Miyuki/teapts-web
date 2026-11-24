'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import {
  GENDER_LABELS,
  SEX_LABELS,
  updateMe,
  type Account,
  type Gender,
  type Sex,
  type UpdateAccountInput,
} from '@/lib/account';
import { ApiError } from '@/lib/api';
import { maskPhone, onlyDigits } from '@/lib/format';
import ChangePasswordForm from './ChangePasswordForm';

type Field = 'name' | 'birthDate' | 'sex' | 'email' | 'phone' | 'form';
type Errors = Partial<Record<Field, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMIT_ERROR =
  'Não foi possível atualizar seus dados. Tente novamente mais tarde.';

function todayIso() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${today.getFullYear()}-${month}-${day}`;
}

function Required() {
  return (
    <span className="ux-req" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={`${id}-error`} className={ui.fieldError} role="alert">
      {message}
    </p>
  ) : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ux-fsection">
      <header>
        <h3>{title}</h3>
      </header>
      <div>{children}</div>
    </section>
  );
}

type ProfileEditFormProps = {
  account: Account;
  onAccountUpdated: (account: Account) => void;
};

// Editar perfil de `meu-perfil-editar.html` (RFAUT004). O CPF não é editado;
// a foto entra com o armazenamento de arquivos.
export default function ProfileEditForm({
  account,
  onAccountUpdated,
}: ProfileEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [socialName, setSocialName] = useState(account.socialName ?? '');
  const [gender, setGender] = useState<Gender | ''>(account.gender ?? '');
  const [birthDate, setBirthDate] = useState(account.birthDate ?? '');
  const [sex, setSex] = useState<Sex | ''>(account.sex ?? '');
  const [email, setEmail] = useState(account.email);
  const [phone, setPhone] = useState(
    account.phone ? maskPhone(account.phone) : '',
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  function validate() {
    const next: Errors = {};
    const phoneDigits = onlyDigits(phone);

    if (!name.trim()) next.name = 'Informe seu nome completo.';
    if (!birthDate || birthDate > todayIso()) {
      next.birthDate = 'Informe uma data de nascimento válida.';
    }
    if (!sex) next.sex = 'Selecione o sexo.';
    if (!email.trim()) {
      next.email = 'Informe seu e-mail.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'Informe um e-mail válido, como nome@exemplo.com.';
    }
    if (phoneDigits && phoneDigits.length < 10) {
      next.phone = 'Informe o telefone com DDD.';
    }

    setErrors(next);

    const first = (
      ['name', 'birthDate', 'sex', 'email', 'phone'] as const
    ).find((field) => next[field]);
    if (first) document.getElementById(`profile-${first}`)?.focus();

    return !first;
  }

  // Só vão no PATCH os campos que mudaram.
  function changes(): UpdateAccountInput {
    const input: UpdateAccountInput = {};
    const nextSocialName = socialName.trim() || null;
    const nextPhone = onlyDigits(phone) || null;

    if (name.trim() !== account.name) input.name = name.trim();
    if (nextSocialName !== account.socialName)
      input.socialName = nextSocialName;
    if ((gender || null) !== account.gender) input.gender = gender || null;
    if (birthDate !== account.birthDate) input.birthDate = birthDate;
    if (sex && sex !== account.sex) input.sex = sex;
    if (email.trim().toLowerCase() !== account.email) {
      input.email = email.trim();
    }
    if (nextPhone !== account.phone) input.phone = nextPhone;

    return input;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !validate()) {
      return;
    }

    const input = changes();

    if (Object.keys(input).length === 0) {
      router.push('/profile');
      return;
    }

    setSubmitting(true);

    try {
      onAccountUpdated(await updateMe(input));
      router.push('/profile?updated=1');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      const message =
        (error instanceof ApiError && error.apiMessage) || SUBMIT_ERROR;

      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: message });
        document.getElementById('profile-email')?.focus();
      } else {
        setErrors({ form: message });
      }

      setSubmitting(false);
    }
  }

  return (
    <>
      {feedback && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{feedback}</span>
        </div>
      )}

      <form className="ux-formcard" noValidate onSubmit={handleSubmit}>
        <div className="ux-formcard-head">
          <div>
            <h2>Editar perfil</h2>
          </div>
        </div>

        {errors.form && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
              <Icon name="alertCircle" />
            </div>
            <span>{errors.form}</span>
          </div>
        )}

        <Section title="Dados pessoais">
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="profile-name">
                Nome completo
                <Required />
              </label>
              <input
                className="input"
                id="profile-name"
                type="text"
                aria-required="true"
                placeholder="Ex.: Maria da Silva"
                value={name}
                disabled={submitting}
                aria-invalid={errors.name ? 'true' : 'false'}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldError id="profile-name" message={errors.name} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-social">
                Nome social
              </label>
              <input
                className="input"
                id="profile-social"
                type="text"
                placeholder="Ex.: Alex Souza"
                value={socialName}
                disabled={submitting}
                onChange={(event) => setSocialName(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-gender">
                Gênero
              </label>
              <select
                className="select"
                id="profile-gender"
                value={gender}
                disabled={submitting}
                onChange={(event) =>
                  setGender(event.target.value as Gender | '')
                }
              >
                <option value="">Selecione</option>
                {(Object.keys(GENDER_LABELS) as Gender[]).map((value) => (
                  <option key={value} value={value}>
                    {GENDER_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-birthDate">
                Data de nascimento
                <Required />
              </label>
              <input
                className="input"
                id="profile-birthDate"
                type="date"
                aria-required="true"
                max={todayIso()}
                value={birthDate}
                disabled={submitting}
                aria-invalid={errors.birthDate ? 'true' : 'false'}
                onChange={(event) => setBirthDate(event.target.value)}
              />
              <FieldError id="profile-birthDate" message={errors.birthDate} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-sex">
                Sexo
                <Required />
              </label>
              <select
                className="select"
                id="profile-sex"
                aria-required="true"
                value={sex}
                disabled={submitting}
                aria-invalid={errors.sex ? 'true' : 'false'}
                onChange={(event) => setSex(event.target.value as Sex | '')}
              >
                <option value="" disabled>
                  Selecione
                </option>
                <option value="female">{SEX_LABELS.female}</option>
                <option value="male">{SEX_LABELS.male}</option>
              </select>
              <FieldError id="profile-sex" message={errors.sex} />
            </div>
          </div>
        </Section>

        <Section title="Contato">
          <div className="form-grid">
            <div className="field full">
              <span className="ux-labeltip">
                <label className="field-label" htmlFor="profile-email">
                  E-mail
                  <Required />
                </label>
                <HelpTooltip id="profile-email-tip" label="E-mail">
                  Depois de salvar, use o novo e-mail para entrar.
                </HelpTooltip>
              </span>
              <input
                className="input"
                id="profile-email"
                type="email"
                aria-required="true"
                placeholder="nome@exemplo.com"
                value={email}
                disabled={submitting}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby="profile-email-tip"
                onChange={(event) => setEmail(event.target.value)}
              />
              <FieldError id="profile-email" message={errors.email} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-phone">
                Telefone
              </label>
              <input
                className="input"
                id="profile-phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                disabled={submitting}
                aria-invalid={errors.phone ? 'true' : 'false'}
                onChange={(event) => setPhone(maskPhone(event.target.value))}
              />
              <FieldError id="profile-phone" message={errors.phone} />
            </div>
          </div>
        </Section>

        <Section title="Senha">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setFeedback('');
              setPasswordOpen(true);
            }}
          >
            <Icon name="lock" className="icon-sm" />
            Redefinir senha
          </button>
        </Section>

        <div className="ux-formcard-foot">
          <Link className="btn" href="/profile">
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            <Icon name="check" className="icon-sm" />
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>

      {passwordOpen && (
        <ChangePasswordForm
          onCancel={() => setPasswordOpen(false)}
          onSuccess={() => {
            setPasswordOpen(false);
            setFeedback('Sua senha foi redefinida com sucesso.');
          }}
        />
      )}
    </>
  );
}
