'use client';

import { useEffect, useRef } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import styles from '../patients.module.css';
import AddPatientForm from './AddPatientForm';

type AddPatientModalProps = {
  open: boolean;
  onClose: () => void;
  onAdded: (name: string) => void;
};

// <dialog> nativo: showModal() prende o foco e o Esc fecha (evento close).
// O formulário só é montado com o modal aberto: as contas são carregadas e o
// formulário volta vazio a cada abertura.
export default function AddPatientModal({
  open,
  onClose,
  onAdded,
}: AddPatientModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="add-patient-title"
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

          <h2 id="add-patient-title">Adicionar paciente</h2>

          <p>
            Escolha a conta da pessoa atendida e, se quiser, inclua quem faz
            parte da rede de apoio.
          </p>

          <AddPatientForm onCancel={onClose} onAdded={onAdded} />
        </>
      )}
    </dialog>
  );
}
