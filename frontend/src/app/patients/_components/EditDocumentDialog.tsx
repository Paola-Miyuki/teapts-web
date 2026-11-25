'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  updateDocument,
  type DocumentMetadata,
  type UpdatedDocument,
} from '@/lib/documents';

import styles from '../patients.module.css';

const SAVE_ERROR = 'Não foi possível atualizar o documento';

export default function EditDocumentDialog({
  document,
  onClose,
  onSaved,
}: {
  document: DocumentMetadata;
  onClose: () => void;
  onSaved: (document: UpdatedDocument) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? '');
  const [titleError, setTitleError] = useState('');
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!title.trim()) {
      setTitleError('Informe o título do documento');
      return;
    }

    setTitleError('');
    setApiError('');
    setSaving(true);

    try {
      const updated = await updateDocument(document.id, {
        title: title.trim(),
        description: description.trim() || null,
      });

      onSaved(updated);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace('/login');
        return;
      }

      setApiError(
        reason instanceof ApiError && reason.apiMessage
          ? reason.apiMessage
          : SAVE_ERROR,
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      id="document-edit"
      size="sm"
      title="Editar documento"
      description={document.title}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="document-edit-form"
            className="btn btn-primary"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id="document-edit-form" noValidate onSubmit={submit}>
        {apiError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{apiError}</p>
          </div>
        )}

        <div className="form-grid">
          <FormField
            id="document-edit-title-field"
            label="Título"
            error={titleError}
            full
          >
            <input
              id="document-edit-title-field"
              className="input"
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError('');
              }}
              aria-required="true"
              aria-invalid={Boolean(titleError)}
            />
          </FormField>

          <FormField
            id="document-edit-description-field"
            label="Descrição"
            required={false}
            full
          >
            <textarea
              id="document-edit-description-field"
              className="input"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
        </div>

        <p className={`muted ${styles.documentEditNote}`}>
          Só o título e a descrição mudam. O arquivo confirmado permanece igual.
        </p>
      </form>
    </Modal>
  );
}
