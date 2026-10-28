'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { isValidPhone, type SupportContact } from '@/lib/patients';
import styles from '../patients.module.css';

type SupportContactFieldsProps = {
  onCancel: () => void;
  onSave: (contact: SupportContact) => void;
};

type ContactField = 'name' | 'email' | 'phone';

const OPTIONAL_FIELDS = ['description', 'email', 'phone'] as const;

// Monta o contato sem espaços externos e sem os campos opcionais vazios.
function toContact(values: Required<SupportContact>): SupportContact {
  const contact: SupportContact = { name: values.name.trim() };

  for (const field of OPTIONAL_FIELDS) {
    const value = values[field].trim();

    if (value) {
      contact[field] = value;
    }
  }

  return contact;
}

// Campos de um contato dentro do formulário do paciente (não é um <form>
// próprio, porque formulários não podem ser aninhados).
export default function SupportContactFields({
  onCancel,
  onSave,
}: SupportContactFieldsProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<Required<SupportContact>>({
    name: '',
    description: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<ContactField | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function update(field: keyof SupportContact, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function fail(field: ContactField, message: string) {
    const refs = { name: nameRef, email: emailRef, phone: phoneRef };

    setInvalidField(field);
    setError(message);
    refs[field].current?.focus();
  }

  function handleSave() {
    if (!values.name.trim()) {
      fail('name', 'Informe o nome do contato.');
      return;
    }

    if (values.email.trim() && !emailRef.current?.checkValidity()) {
      fail('email', 'Informe um e-mail válido para o contato.');
      return;
    }

    if (values.phone.trim() && !isValidPhone(values.phone.trim())) {
      fail('phone', 'Informe um telefone válido para o contato.');
      return;
    }

    onSave(toContact(values));
  }

  // Enter num campo do contato salva o contato, e não o paciente.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      handleSave();
    }
  }

  return (
    <div
      className={styles.contactFields}
      role="group"
      aria-label="Novo contato de suporte"
      onKeyDown={handleKeyDown}
    >
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <span>{error}</span>
        </div>
      )}

      <div className={styles.contactGrid}>
        <div className={`${ui.field} ${styles.fullWidth}`}>
          <label htmlFor="contact-name" className={ui.label}>
            Nome do contato
          </label>

          <input
            ref={nameRef}
            id="contact-name"
            className={ui.input}
            placeholder="Nome completo"
            value={values.name}
            aria-invalid={invalidField === 'name' ? true : undefined}
            onChange={(event) => update('name', event.target.value)}
          />
        </div>

        <div className={ui.field}>
          <label htmlFor="contact-email" className={ui.label}>
            E-mail <span className={styles.optional}>(opcional)</span>
          </label>

          <input
            ref={emailRef}
            id="contact-email"
            type="email"
            className={ui.input}
            placeholder="email@exemplo.com"
            value={values.email}
            aria-invalid={invalidField === 'email' ? true : undefined}
            onChange={(event) => update('email', event.target.value)}
          />
        </div>

        <div className={ui.field}>
          <label htmlFor="contact-phone" className={ui.label}>
            Telefone <span className={styles.optional}>(opcional)</span>
          </label>

          <input
            ref={phoneRef}
            id="contact-phone"
            type="tel"
            inputMode="tel"
            className={ui.input}
            placeholder="(00) 00000-0000"
            value={values.phone}
            aria-describedby="contact-phone-hint"
            aria-invalid={invalidField === 'phone' ? true : undefined}
            onChange={(event) => update('phone', event.target.value)}
          />

          <small id="contact-phone-hint" className={ui.hint}>
            Com DDD, ex.: (11) 98765-4321.
          </small>
        </div>

        <div className={`${ui.field} ${styles.fullWidth}`}>
          <label htmlFor="contact-description" className={ui.label}>
            Descrição <span className={styles.optional}>(opcional)</span>
          </label>

          <textarea
            id="contact-description"
            className={`${ui.input} ${styles.textarea}`}
            placeholder="Relação com o paciente e como ajuda no cuidado"
            rows={3}
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </div>
      </div>

      <div className={styles.contactActions}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={onCancel}
        >
          Descartar contato
        </button>

        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={handleSave}
        >
          Salvar contato
        </button>
      </div>
    </div>
  );
}
