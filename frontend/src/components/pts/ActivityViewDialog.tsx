'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Modal from '@/components/Modal';
import {
  ACTIVITY_EXECUTOR_LABELS,
  ACTIVITY_MODALITY_LABELS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  formatFrequency,
  getActivity,
  VISIT_PLACE_LABELS,
  type ActivityDetails,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { SPECIALISMS } from '@/lib/professionals';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

type ActivityViewDialogProps = {
  activityId: string;
  team: { id: string; name: string }[];
  onClose: () => void;
};

function specialismLabel(value: string) {
  return SPECIALISMS.find((item) => item.value === value)?.label ?? value;
}

export default function ActivityViewDialog({
  activityId,
  team,
  onClose,
}: ActivityViewDialogProps) {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setActivity(null);
    setError(null);
    setRetryKey((current) => current + 1);
  }, []);
  const executorIds =
    activity && activity.executorProfessionalIds.length === 0
      ? activity.authorProfessionalId
        ? [activity.authorProfessionalId]
        : []
      : (activity?.executorProfessionalIds ?? []);

  useEffect(() => {
    const controller = new AbortController();

    getActivity(activityId, controller.signal)
      .then(setActivity)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(reason);
      });

    return () => controller.abort();
  }, [activityId, retryKey, router]);

  return (
    <Modal
      open
      id="activity-view"
      title={activity?.title ?? 'Visualizar atividade'}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Fechar
        </button>
      }
    >
      {error ? (
        <div role="alert">
          <p>
            {error instanceof ApiError && error.apiMessage
              ? error.apiMessage
              : LOAD_ERROR}
          </p>
          <button type="button" className="btn" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : !activity ? (
        <p role="status" aria-live="polite">
          Carregando atividade...
        </p>
      ) : (
        <>
          <section>
            <h3>Status, tipo e meta</h3>
            <dl className="data-grid">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${activity.status}`}>
                    {ACTIVITY_STATUS_LABELS[activity.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{ACTIVITY_TYPE_LABELS[activity.type]}</dd>
              </div>
              <div>
                <dt>Especialidade</dt>
                <dd>{specialismLabel(activity.specialism)}</dd>
              </div>
              <div>
                <dt>Meta</dt>
                <dd>{activity.goal?.title ?? 'Sem meta associada'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>Como é feita</h3>
            <dl className="data-grid">
              <div className="full">
                <dt>Descrição</dt>
                <dd>{activity.description}</dd>
              </div>
              <div>
                <dt>Frequência</dt>
                <dd>{formatFrequency(activity.frequency)}</dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>{ACTIVITY_MODALITY_LABELS[activity.modality]}</dd>
              </div>
              {activity.visitPlace && (
                <div>
                  <dt>Local</dt>
                  <dd>{VISIT_PLACE_LABELS[activity.visitPlace]}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <h3>Quem executa</h3>
            <dl className="data-grid">
              <div>
                <dt>Executor</dt>
                <dd>{ACTIVITY_EXECUTOR_LABELS[activity.executor]}</dd>
              </div>
              {executorIds.length > 0 && (
                <div className="full">
                  <dt>Profissionais</dt>
                  <dd>
                    {executorIds
                      .map(
                        (id) =>
                          team.find((member) => member.id === id)?.name ?? id,
                      )
                      .join(', ')}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <h3>Registro</h3>
            <dl className="data-grid">
              <div>
                <dt>Criada em</dt>
                <dd>{formatDate(activity.createdAt)}</dd>
              </div>
              <div>
                <dt>Atendimentos</dt>
                <dd>{activity.appointmentsCount}</dd>
              </div>
              <div className="full">
                <dt>Documentos</dt>
                <dd>
                  {activity.documents.length > 0 ? (
                    <ul className="mini-list">
                      {activity.documents.map((document) => (
                        <li key={document.id}>{document.title}</li>
                      ))}
                    </ul>
                  ) : (
                    'Nenhum documento associado'
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </Modal>
  );
}
