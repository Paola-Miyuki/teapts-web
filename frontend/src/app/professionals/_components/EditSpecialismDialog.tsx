'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  COUNCIL_STATES,
  councilOf,
  formatRegistration,
  SPECIALISMS,
  updateProfessional,
  type Professional,
  type ProfessionalSpecialism,
  type UpdatedProfessional,
} from '@/lib/professionals';

const SAVE_ERROR = 'Não foi possível salvar a especialidade';

type FieldName = 'specialism' | 'number' | 'state';

const FIELD_IDS: Record<FieldName, string> = {
  specialism: 'edit-prof',
  number: 'edit-regnum',
  state: 'edit-reguf',
};

// Ordem dos campos na tela, para focar o primeiro com erro.
const FIELD_ORDER: FieldName[] = ['specialism', 'number', 'state'];

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

// Formulário de "Editar especialidade" (`profissionais.html`): o conselho vem
// da especialidade; mesmo conselho mantém o registro, outro pede nº e UF
// (RN026). Montado só com o modal aberto, então o estado começa limpo.
function EditSpecialismForm({
  professional,
  formId,
  onSavingChange,
  onSaved,
  onUnauthorized,
}: {
  professional: Professional;
  formId: string;
  onSavingChange: (saving: boolean) => void;
  onSaved: (updated: UpdatedProfessional) => void;
  onUnauthorized: () => void;
}) {
  const [specialism, setSpecialism] = useState<ProfessionalSpecialism>(
    professional.specialism.id,
  );
  const [number, setNumber] = useState('');
  const [state, setState] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentCouncil = councilOf(professional.specialism.id);
  const council = councilOf(specialism);
  const changesCouncil = council !== currentCouncil;

  function clearError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const found: Partial<Record<FieldName, string>> = {};

    if (specialism === professional.specialism.id) {
      found.specialism = 'Escolha uma profissão diferente da atual';
    }

    if (changesCouncil && !number.trim()) {
      found.number = 'Informe o número do novo registro';
    }

    if (changesCouncil && !state) {
      found.state = 'Escolha a UF do registro';
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
    onSavingChange(true);

    try {
      onSaved(
        await updateProfessional(professional.id, {
          specialism,
          ...(changesCouncil
            ? { councilNumber: number, councilState: state }
            : {}),
        }),
      );
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }

      setSubmitError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : SAVE_ERROR,
      );
    } finally {
      setIsSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      {submitError ? (
        <div role="alert" className={`${ui.alert} ${ui.alertError}`}>
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="form-grid">
        <div className="full">
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
                setSpecialism(event.target.value as ProfessionalSpecialism);
                clearError('specialism');
              }}
            >
              {SPECIALISMS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          id="edit-council"
          label="Conselho regional"
          tip="Preenchido pela profissão."
        >
          <input
            className="input"
            id="edit-council"
            type="text"
            readOnly
            value={council}
          />
        </Field>

        {changesCouncil ? null : (
          <Field
            id="edit-regkeep"
            label="Registro no conselho"
            tip="Mantido: mesmo conselho."
          >
            <input
              className="input"
              id="edit-regkeep"
              type="text"
              readOnly
              value={
                professional.registration
                  ? formatRegistration(professional.registration)
                  : ''
              }
            />
          </Field>
        )}

        {changesCouncil && (
          <>
            <Field
              id={FIELD_IDS.number}
              label="Nº do novo registro"
              required
              tip="O conselho mudou: o registro anterior é apagado."
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
          </>
        )}
      </div>
    </form>
  );
}

// Modal "Editar especialidade" do admin. Sucesso devolve o perfil atualizado
// para a lista; 401 manda para o login; os demais erros ficam no modal.
export default function EditSpecialismDialog({
  professional,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  professional: Professional | null;
  onClose: () => void;
  onSaved: (updated: UpdatedProfessional) => void;
  onUnauthorized: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const formId = 'professional-edit-form';

  return (
    <Modal
      open={professional !== null}
      id="professional-edit"
      size="sm"
      title={professional ? `Editar especialidade de ${professional.name}` : ''}
      description={
        professional?.registration
          ? formatRegistration(professional.registration)
          : undefined
      }
      busy={isSaving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={isSaving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={isSaving}
            aria-busy={isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      {professional && (
        <EditSpecialismForm
          key={professional.id}
          professional={professional}
          formId={formId}
          onSavingChange={setIsSaving}
          onSaved={onSaved}
          onUnauthorized={onUnauthorized}
        />
      )}
    </Modal>
  );
}
