'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { maskPhone } from '@/lib/format';
import {
  createSupportContact,
  isValidPhone,
  updateSupportContact,
  type SupportContact,
} from '@/lib/patients';

const SAVE_ERROR = 'Não foi possível salvar o contato';

type SupportContactDialogProps = {
  // accountId do perfil de paciente.
  patientId: string;
  patientName: string;
  // Contato em edição; sem ele, o diálogo adiciona um contato.
  contact?: SupportContact;
  onSaved: (contact: SupportContact) => void;
  onClose: () => void;
};

type Errors = Partial<Record<'name' | 'email' | 'phone', string>>;

// Texto do campo opcional: vazio vira `null` (limpa o campo no PATCH).
function textOrNull(value: string) {
  return value.trim() || null;
}

// Modal "Editar contato" / "Adicionar contato" de `paciente.html`: cada
// contato é salvo na hora (RFPAC003). Monte o componente só com o diálogo
// aberto, para os campos começarem do contato certo.
export default function SupportContactDialog({
  patientId,
  patientName,
  contact,
  onSaved,
  onClose,
}: SupportContactDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(contact?.name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [description, setDescription] = useState(contact?.description ?? '');
  const [isEmergency, setIsEmergency] = useState(contact?.isEmergency ?? false);
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formId = contact ? 'support-contact-edit' : 'support-contact-add';

  function validate(): Errors {
    const found: Errors = {};

    if (!name.trim()) {
      found.name = 'Informe o nome do contato';
    }

    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      found.email = 'Informe um e-mail válido para o contato';
    }

    if (phone.trim() && !isValidPhone(phone.trim())) {
      found.phone = 'Informe um telefone válido para o contato';
    } else if (isEmergency && !phone.trim()) {
      found.phone = 'Informe o telefone do contato de emergência';
    }

    if (!found.email && !found.phone && !email.trim() && !phone.trim()) {
      found.email = 'Informe o e-mail ou o telefone do contato';
    }

    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const found = validate();

    setErrors(found);
    setApiError('');

    if (Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const values = {
        name: name.trim(),
        description: textOrNull(description),
        email: textOrNull(email),
        phone: textOrNull(phone),
        isEmergency,
      };
      const saved = contact
        ? await updateSupportContact(patientId, contact.id, values)
        : await createSupportContact(patientId, {
            name: values.name,
            ...(values.description && { description: values.description }),
            ...(values.email && { email: values.email }),
            ...(values.phone && { phone: values.phone }),
            isEmergency,
          });

      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      setApiError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : SAVE_ERROR,
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      id={formId}
      size="sm"
      title={contact ? 'Editar contato' : 'Adicionar contato'}
      description={`Contato de ${patientName}`}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting
              ? 'Salvando...'
              : contact
                ? 'Salvar contato'
                : 'Adicionar contato'}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit}>
        {apiError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{apiError}</p>
          </div>
        )}

        <div className="form-grid">
          <div className="field full">
            <label className="field-label" htmlFor={`${formId}-name`}>
              Nome do contato
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <input
              className="input"
              id={`${formId}-name`}
              type="text"
              aria-required="true"
              placeholder="Ex.: Maria da Silva"
              value={name}
              disabled={submitting}
              aria-invalid={errors.name ? 'true' : 'false'}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name && (
              <p className={ui.fieldError} role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div className="field">
            <span className="ux-labeltip">
              <label className="field-label" htmlFor={`${formId}-email`}>
                E-mail
              </label>
              <HelpTooltip id={`${formId}-email-tip`} label="E-mail">
                Informe e-mail ou telefone.
              </HelpTooltip>
            </span>
            <input
              className="input"
              id={`${formId}-email`}
              type="email"
              placeholder="nome@exemplo.com"
              value={email}
              disabled={submitting}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={`${formId}-email-tip`}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email && (
              <p className={ui.fieldError} role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div className="field">
            <span className="ux-labeltip">
              <label className="field-label" htmlFor={`${formId}-phone`}>
                Telefone
              </label>
              <HelpTooltip id={`${formId}-phone-tip`} label="Telefone">
                Obrigatório no contato de emergência.
              </HelpTooltip>
            </span>
            <input
              className="input"
              id={`${formId}-phone`}
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              disabled={submitting}
              aria-invalid={errors.phone ? 'true' : 'false'}
              aria-describedby={`${formId}-phone-tip`}
              onChange={(event) => setPhone(maskPhone(event.target.value))}
            />
            {errors.phone && (
              <p className={ui.fieldError} role="alert">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="field full">
            <span className="ux-labeltip">
              <label className="field-label" htmlFor={`${formId}-description`}>
                Descrição
              </label>
              <HelpTooltip id={`${formId}-description-tip`} label="Descrição">
                Relação com o paciente e como ajuda no cuidado.
              </HelpTooltip>
            </span>
            <textarea
              className="input"
              id={`${formId}-description`}
              rows={2}
              value={description}
              disabled={submitting}
              aria-describedby={`${formId}-description-tip`}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <label className="ux-check full">
            <input
              type="checkbox"
              checked={isEmergency}
              disabled={submitting}
              onChange={(event) => setIsEmergency(event.target.checked)}
            />
            Contato de emergência
          </label>
        </div>
      </form>
    </Modal>
  );
}
