'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { SupportContact } from '@/lib/patients';
import styles from '../new.module.css';

type SupportContactModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (contact: SupportContact) => void;
};

type ContactField = 'name' | 'email';

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

function ContactForm({
  onClose,
  onSave,
}: Omit<SupportContactModalProps, 'open'>) {
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<Required<SupportContact>>({
    name: '',
    description: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<ContactField | null>(null);

  function update(field: keyof SupportContact, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function fail(field: ContactField, message: string) {
    setInvalidField(field);
    setError(message);
    (field === 'name' ? nameRef : emailRef).current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.name.trim()) {
      fail('name', 'Informe o nome do contato.');
      return;
    }

    if (values.email.trim() && !emailRef.current?.checkValidity()) {
      fail('email', 'Informe um e-mail válido para o contato.');
      return;
    }

    onSave(toContact(values));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <span>{error}</span>
        </div>
      )}

      <div className={`${ui.field} ${styles.field}`}>
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

      <div className={`${ui.field} ${styles.field}`}>
        <label htmlFor="contact-description" className={ui.label}>
          Descrição <span className={styles.optional}>(opcional)</span>
        </label>

        <input
          id="contact-description"
          className={ui.input}
          placeholder="Relação com o paciente"
          value={values.description}
          onChange={(event) => update('description', event.target.value)}
        />
      </div>

      <div className={`${ui.field} ${styles.field}`}>
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

      <div className={`${ui.field} ${styles.field}`}>
        <label htmlFor="contact-phone" className={ui.label}>
          Telefone <span className={styles.optional}>(opcional)</span>
        </label>

        <input
          id="contact-phone"
          type="tel"
          className={ui.input}
          placeholder="(00) 00000-0000"
          value={values.phone}
          onChange={(event) => update('phone', event.target.value)}
        />
      </div>

      <div className={`${styles.formActions} ${styles.dialogActions}`}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={onClose}
        >
          Cancelar
        </button>

        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>
          Adicionar contato
        </button>
      </div>
    </form>
  );
}

// <dialog> nativo: showModal() prende o foco e o Esc fecha (evento close).
// O formulário só é montado com o modal aberto, então volta vazio a cada abertura.
export default function SupportContactModal({
  open,
  onClose,
  onSave,
}: SupportContactModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      // O showModal() focaria o botão de fechar, o primeiro do modal.
      dialog.querySelector<HTMLInputElement>('#contact-name')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="contact-modal-title"
      onClose={onClose}
      onClick={(event) => {
        // Clique no fundo (fora da caixa) fecha o modal.
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      {open && (
        <>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.dialogClose}`}
            aria-label="Fechar janela"
            onClick={onClose}
          >
            <Icon name="close" className={ui.icon} />
          </button>

          <h2 id="contact-modal-title">Adicionar contato de suporte</h2>

          <p>Inclua uma pessoa que participa da rede de apoio.</p>

          <ContactForm onClose={onClose} onSave={onSave} />
        </>
      )}
    </dialog>
  );
}
