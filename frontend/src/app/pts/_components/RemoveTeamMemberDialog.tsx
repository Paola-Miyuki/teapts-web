'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  removeTeamMember,
  type PtsProfessional,
  type PtsTeamResponse,
} from '@/lib/pts';

import styles from '../pts.module.css';

type RemoveTeamMemberDialogProps = {
  ptsId: string;
  // null: diálogo fechado.
  member: PtsProfessional | null;
  onClose: () => void;
  onRemoved: (team: PtsTeamResponse) => void;
};

const REMOVE_ERROR = 'Não foi possível remover o profissional da equipe.';

// Confirmação "Remover da equipe?" (RFEM003), no padrão do "Rejeitar
// proposta?" de frontend/design/propostas-pts.html. <dialog> nativo:
// showModal() prende o foco e o Esc fecha, menos durante o envio.
export default function RemoveTeamMemberDialog({
  ptsId,
  member,
  onClose,
  onRemoved,
}: RemoveTeamMemberDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const open = member !== null;

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

  function handleClose() {
    if (!submitting) {
      onClose();
    }
  }

  async function handleConfirm() {
    // Sem clique duplo: um envio por vez.
    if (!member || submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const team = await removeTeamMember(ptsId, member.id);
      setSubmitting(false);
      onRemoved(team);
    } catch (caught) {
      setSubmitting(false);

      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : REMOVE_ERROR,
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={ui.dialog}
      aria-labelledby="remove-member-title"
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          handleClose();
        }
      }}
    >
      {member && (
        <>
          <button
            type="button"
            className={`${ui.iconButton} ${ui.dialogClose}`}
            aria-label="Fechar janela"
            onClick={handleClose}
            disabled={submitting}
          >
            <Icon name="close" className={ui.icon} />
          </button>

          <h2 id="remove-member-title">Remover da equipe?</h2>

          <p>
            <strong>{member.name || 'O profissional'}</strong> perde o acesso a
            este PTS. Os registros que ele já fez são mantidos.
          </p>

          {error && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              <p>{error}</p>
            </div>
          )}

          <div className={styles.dialogActions}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={handleClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? 'Removendo...' : 'Remover'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
