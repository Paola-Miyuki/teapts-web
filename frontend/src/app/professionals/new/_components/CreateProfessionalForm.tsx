'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AccountCombobox from '@/app/patients/_components/AccountCombobox';
import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import type { AccountOption } from '@/lib/patients';
import {
  COUNCIL_STATES,
  councilOf,
  createProfessional,
  SPECIALISMS,
  type ProfessionalSpecialism,
} from '@/lib/professionals';

const SAVE_ERROR = 'Não foi possível adicionar o profissional.';

type FieldName = 'account' | 'specialism' | 'number' | 'state' | 'cnes';

const FIELD_IDS: Record<FieldName, string> = {
  account: 'pro-account',
  specialism: 'cpro-prof',
  number: 'cpro-number',
  state: 'cpro-uf',
  cnes: 'cpro-cnes',
};

// Ordem dos campos na tela, para focar o primeiro com erro.
const FIELD_ORDER: FieldName[] = [
  'account',
  'specialism',
  'number',
  'state',
  'cnes',
];

function Field({
  id,
  label,
  required = false,
  tip,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  tip?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <span className="ux-labeltip">
        <label className="field-label" htmlFor={id}>
          {label}
          {required && (
            <span className="ux-req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {tip && (
          <HelpTooltip id={`${id}-tip`} label={label}>
            {tip}
          </HelpTooltip>
        )}
      </span>
      {children}
      {error ? (
        <p id={`${id}-error`} className={ui.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Formulário de `criar-profissional.html`: conta sem perfil, especialidade
// (o conselho vem dela), registro, instituição e CNES.
export default function CreateProfessionalForm() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountOption | null>(null);
  const [specialism, setSpecialism] = useState<ProfessionalSpecialism | ''>('');
  const [number, setNumber] = useState('');
  const [state, setState] = useState('');
  const [institution, setInstitution] = useState('');
  const [cnes, setCnes] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitError) {
      errorRef.current?.focus();
    }
  }, [submitError]);

  function clearError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const found: Partial<Record<FieldName, string>> = {};

    if (!account) {
      found.account = 'Escolha a conta.';
    }

    if (!specialism) {
      found.specialism = 'Escolha a profissão.';
    }

    if (!number.trim()) {
      found.number = 'Informe o número de registro.';
    }

    if (!state) {
      found.state = 'Escolha a UF do registro.';
    }

    if (cnes.trim() && !/^\d{7}$/.test(cnes.trim())) {
      found.cnes = 'O CNES deve ter 7 dígitos.';
    }

    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setSubmitError('');
    const found = validate();
    setErrors(found);

    const first = FIELD_ORDER.find((field) => found[field]);

    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    setIsSaving(true);

    try {
      await createProfessional({
        accountId: account!.id,
        specialism: specialism as ProfessionalSpecialism,
        councilNumber: number,
        councilState: state,
        institution,
        cnes,
      });

      router.push('/professionals?added=1');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      // 403, 404 e 409 mostram a mensagem da API.
      setSubmitError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : SAVE_ERROR,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {submitError ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className={`${ui.alert} ${ui.alertError}`}
        >
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>
          <span>{submitError}</span>
        </div>
      ) : null}

      <form className="ux-formcard" onSubmit={handleSubmit} noValidate>
        <div className="ux-formcard-head">
          <div>
            <h2>Novo perfil profissional</h2>
          </div>
        </div>

        <section className="ux-fsection">
          <header>
            <h3>Conta</h3>
          </header>
          <div>
            <Field
              id={FIELD_IDS.account}
              label="Conta"
              required
              error={errors.account}
            >
              <AccountCombobox
                id={FIELD_IDS.account}
                value={account}
                onChange={(next) => {
                  setAccount(next);
                  clearError('account');
                }}
                disabled={isSaving}
                required
                invalid={Boolean(errors.account)}
                describedBy={errors.account ? 'pro-account-error' : undefined}
              />
            </Field>
          </div>
        </section>

        <section className="ux-fsection">
          <header>
            <span className="ux-titletip">
              <h3>Perfil profissional</h3>
              <HelpTooltip id="cpro-section-tip" label="Perfil profissional">
                Com registro em dois conselhos, informe um.
              </HelpTooltip>
            </span>
          </header>
          <div>
            <div className="form-grid">
              <Field
                id={FIELD_IDS.specialism}
                label="Profissão"
                required
                error={errors.specialism}
              >
                <select
                  className="select"
                  id={FIELD_IDS.specialism}
                  aria-required="true"
                  aria-invalid={Boolean(errors.specialism)}
                  value={specialism}
                  disabled={isSaving}
                  onChange={(event) => {
                    setSpecialism(
                      event.target.value as ProfessionalSpecialism | '',
                    );
                    clearError('specialism');
                  }}
                >
                  <option value="">Selecione</option>
                  {SPECIALISMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                id="cpro-council"
                label="Conselho regional"
                tip="Preenchido pela profissão."
              >
                <input
                  className="input"
                  id="cpro-council"
                  type="text"
                  readOnly
                  value={councilOf(specialism)}
                />
              </Field>

              <Field
                id={FIELD_IDS.number}
                label="Nº de registro"
                required
                error={errors.number}
              >
                <input
                  className="input"
                  id={FIELD_IDS.number}
                  type="text"
                  placeholder="Ex.: 12345"
                  aria-required="true"
                  aria-invalid={Boolean(errors.number)}
                  value={number}
                  disabled={isSaving}
                  onChange={(event) => {
                    setNumber(event.target.value);
                    clearError('number');
                  }}
                />
              </Field>

              <Field
                id={FIELD_IDS.state}
                label="UF do registro"
                required
                error={errors.state}
              >
                <select
                  className="select"
                  id={FIELD_IDS.state}
                  aria-required="true"
                  aria-invalid={Boolean(errors.state)}
                  value={state}
                  disabled={isSaving}
                  onChange={(event) => {
                    setState(event.target.value);
                    clearError('state');
                  }}
                >
                  <option value="">UF</option>
                  {COUNCIL_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="cpro-inst" label="Instituição ou serviço de vínculo">
                <input
                  className="input"
                  id="cpro-inst"
                  type="text"
                  placeholder="Ex.: Clínica Escola de Saúde"
                  value={institution}
                  disabled={isSaving}
                  onChange={(event) => setInstitution(event.target.value)}
                />
              </Field>

              <Field id={FIELD_IDS.cnes} label="CNES" error={errors.cnes}>
                <input
                  className="input"
                  id={FIELD_IDS.cnes}
                  type="text"
                  inputMode="numeric"
                  placeholder="0000000"
                  aria-invalid={Boolean(errors.cnes)}
                  value={cnes}
                  disabled={isSaving}
                  onChange={(event) => {
                    setCnes(event.target.value);
                    clearError('cnes');
                  }}
                />
              </Field>
            </div>
          </div>
        </section>

        <div className="ux-formcard-foot">
          <Link className="btn" href="/professionals">
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving}
            aria-busy={isSaving}
          >
            <Icon name="check" className="icon-sm" />
            {isSaving ? 'Adicionando...' : 'Adicionar profissional'}
          </button>
        </div>
      </form>
    </>
  );
}
