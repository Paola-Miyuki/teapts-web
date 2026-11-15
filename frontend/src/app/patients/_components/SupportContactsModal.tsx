'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  getSupportContacts,
  updateSupportContacts,
  type SupportContact,
} from '@/lib/patients';
import styles from '../patients.module.css';
import SupportContactFields, {
  type SupportContactFieldsHandle,
} from './SupportContactFields';
import SupportContactList from './SupportContactList';

const LOAD_ERROR = 'Não foi possível carregar os contatos de suporte.';
const SAVE_ERROR = 'Não foi possível salvar os contatos de suporte.';

export type SupportContactsPatient = {
  // accountId do perfil de paciente.
  id: string;
  name: string;
};

type SupportContactsModalProps = {
  // Paciente cujos contatos são editados; `null` fecha o modal.
  patient: SupportContactsPatient | null;
  onClose: () => void;
  onSaved: (contacts: SupportContact[]) => void;
};

// Mensagem da API quando houver (400, 403, 404); senão, a mensagem padrão.
function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.apiMessage
    ? error.apiMessage
    : fallback;
}

// Edição dos contatos de suporte do paciente (RFPAC003). A lista é salva
// inteira (DP012): o usuário inclui, edita e remove contatos e salva tudo de
// uma vez. <dialog> nativo, no mesmo padrão do AddPatientModal; o conteúdo só
// é montado com o modal aberto, então os contatos são carregados a cada
// abertura.
export default function SupportContactsModal({
  patient,
  onClose,
  onSaved,
}: SupportContactsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const open = patient !== null;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    if (!submitting) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={ui.dialog}
      aria-labelledby="support-contacts-title"
      onCancel={(event) => {
        // O Esc não fecha o modal com a gravação em andamento.
        if (submitting) {
          event.preventDefault();
        }
      }}
      onClose={onClose}
      onClick={(event) => {
        // Clique no fundo (fora da caixa) fecha o modal.
        if (event.target === dialogRef.current) {
          close();
        }
      }}
    >
      {patient && (
        <>
          <button
            type="button"
            className={`${ui.iconButton} ${ui.dialogClose}`}
            aria-label="Fechar janela"
            disabled={submitting}
            onClick={close}
          >
            <Icon name="close" className={ui.icon} />
          </button>

          <h2 id="support-contacts-title">Contatos de suporte</h2>

          <p>
            Pessoas que ajudam no cuidado de {patient.name}. Um contato de
            suporte não é responsável tutelar e não acessa informações clínicas.
          </p>

          <SupportContactsForm
            key={patient.id}
            patientId={patient.id}
            submitting={submitting}
            onSubmittingChange={setSubmitting}
            onCancel={close}
            onSaved={(contacts) => {
              setSubmitting(false);
              onSaved(contacts);
            }}
          />
        </>
      )}
    </dialog>
  );
}

type SupportContactsFormProps = {
  patientId: string;
  submitting: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onCancel: () => void;
  onSaved: (contacts: SupportContact[]) => void;
};

function SupportContactsForm({
  patientId,
  submitting,
  onSubmittingChange,
  onCancel,
  onSaved,
}: SupportContactsFormProps) {
  const router = useRouter();
  const fieldsRef = useRef<SupportContactFieldsHandle>(null);

  // `null` enquanto o GET carrega.
  const [contacts, setContacts] = useState<SupportContact[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  // Índice do contato em edição, 'new' para um contato novo.
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  // Muda a cada contato aberto, para os campos começarem limpos mesmo quando
  // um contato novo abre logo depois de outro.
  const [fieldsKey, setFieldsKey] = useState(0);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    getSupportContacts(patientId, { signal: controller.signal })
      .then((profile) => {
        if (!controller.signal.aborted) {
          setContacts(profile.supportContacts);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setLoadError(messageOf(error, LOAD_ERROR));
      });

    return () => controller.abort();
  }, [patientId, retryKey, router]);

  if (loadError) {
    return (
      <>
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <span>{loadError}</span>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={onCancel}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={() => {
              setLoadError('');
              setRetryKey((current) => current + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      </>
    );
  }

  if (contacts === null) {
    return (
      <p className={styles.contactsStatus} role="status" aria-live="polite">
        <span className={styles.loader} aria-hidden="true" />
        Carregando contatos...
      </p>
    );
  }

  const list = contacts;

  // Lista com o contato aberto já aplicado: o contato novo vai para o fim
  // (os índices dos outros não mudam) e o editado fica no lugar. `null` se o
  // contato aberto é inválido; o erro aparece no campo. Um contato novo em
  // branco é descartado.
  function commitOpenContact(): SupportContact[] | null {
    if (editing === null) {
      return list;
    }

    const contact = fieldsRef.current?.validate();

    if (!contact) {
      return null;
    }

    if (contact === 'empty') {
      return list;
    }

    return editing === 'new'
      ? [...list, contact]
      : list.map((current, index) => (index === editing ? contact : current));
  }

  // Guarda o contato aberto e abre outro (`next`) ou nenhum (`null`).
  function openContact(next: number | 'new' | null) {
    const committed = commitOpenContact();

    if (!committed) {
      return;
    }

    setContacts(committed);
    setEditing(next);
    setFieldsKey((current) => current + 1);
    setFormError('');
  }

  function removeContact(index: number) {
    // Remover o contato aberto só fecha os campos, sem validar.
    const committed = index === editing ? list : commitOpenContact();

    if (!committed) {
      return;
    }

    setContacts(committed.filter((_, i) => i !== index));
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    // O contato aberto é validado e vai junto com a lista. Inválido: o erro
    // aparece no campo e nada vai para a API.
    const next = commitOpenContact();

    if (!next) {
      return;
    }

    setContacts(next);
    setEditing(null);
    setFormError('');
    onSubmittingChange(true);

    try {
      const profile = await updateSupportContacts(patientId, next);

      onSaved(profile.supportContacts);
    } catch (error) {
      onSubmittingChange(false);

      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      setFormError(messageOf(error, SAVE_ERROR));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      {formError && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <span>{formError}</span>
        </div>
      )}

      {list.length === 0 && editing === null && (
        <p className={styles.contactsStatus}>
          Nenhum contato de suporte cadastrado.
        </p>
      )}

      <SupportContactList
        contacts={list}
        onEdit={submitting ? undefined : openContact}
        onRemove={submitting ? undefined : removeContact}
      />

      {editing !== null && (
        // Sem "Salvar contato": o contato aberto é guardado ao adicionar
        // outro, editar, remover ou salvar a lista.
        <SupportContactFields
          key={fieldsKey}
          ref={fieldsRef}
          contact={editing === 'new' ? undefined : list[editing]}
          showSave={false}
          onCancel={() => {
            setEditing(null);
            setFormError('');
          }}
          onSave={() => openContact(null)}
        />
      )}

      <button
        type="button"
        className={`${ui.btn} ${ui.btnSecondary} ${styles.addContact} ${styles.addContactSpaced}`}
        disabled={submitting}
        onClick={() => openContact('new')}
      >
        <Icon name="plus" className={ui.icon} />
        Adicionar contato
      </button>

      <div className={styles.formActions}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          disabled={submitting}
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className={`${ui.btn} ${ui.btnPrimary}`}
          disabled={submitting}
        >
          {submitting ? 'Salvando...' : 'Salvar contatos'}
        </button>
      </div>
    </form>
  );
}
