'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { deleteGoal, type Goal } from '@/lib/goals';

const DELETE_ERROR = 'Não foi possível excluir a meta';

type DeleteGoalDialogProps = {
  ptsId: string;
  goal: Goal;
  onDeleted: () => void;
  onClose: () => void;
};

// "Excluir a meta?"; com atividades ligadas, `goal-blocked` de `pts-detalhe.html`.
export default function DeleteGoalDialog({
  ptsId,
  goal,
  onDeleted,
  onClose,
}: DeleteGoalDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setSubmitting(true);
    setError('');

    try {
      await deleteGoal(ptsId, goal.id);
      onDeleted();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : DELETE_ERROR,
      );
      setSubmitting(false);
    }
  }

  if (goal.activitiesCount > 0) {
    return (
      <Modal
        open
        id="goal-blocked"
        size="sm"
        title="Desligue as atividades antes"
        description={goal.title}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn" onClick={onClose}>
              Fechar
            </button>
            <a className="btn btn-primary" href="#atividades" onClick={onClose}>
              Ir para Atividades
            </a>
          </>
        }
      >
        <p>
          {`Esta meta tem ${goal.activitiesCount} ${
            goal.activitiesCount === 1
              ? 'atividade ligada'
              : 'atividades ligadas'
          }. Desligue cada uma da meta na aba Atividades e depois exclua a meta.`}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      id="goal-delete"
      size="sm"
      title="Excluir a meta?"
      description="A meta sai da ficha e continua no histórico do PTS. A última meta do PTS não pode ser excluída."
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
            type="button"
            className="btn btn-danger"
            disabled={submitting}
            aria-busy={submitting}
            onClick={confirm}
          >
            {submitting ? 'Excluindo...' : 'Excluir meta'}
          </button>
        </>
      }
    >
      <p>
        <strong>{goal.title}</strong>
      </p>
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <p>{error}</p>
        </div>
      )}
    </Modal>
  );
}
