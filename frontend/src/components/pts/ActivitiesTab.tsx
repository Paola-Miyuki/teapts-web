'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  formatFrequency,
  type Activity,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { SPECIALISMS } from '@/lib/professionals';

import ActivityFormDialog, {
  type ActivityGoalOption,
  type ActivityTeamMember,
} from './ActivityFormDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

type ActivitiesTabProps = {
  ptsId: string;
  // null enquanto carrega.
  activities: Activity[] | null;
  error: unknown;
  reload: () => void;
  canCreate: boolean;
  team: ActivityTeamMember[];
  goals: ActivityGoalOption[];
  isAdmin: boolean;
};

function specialismLabel(value: string) {
  return SPECIALISMS.find((item) => item.value === value)?.label ?? value;
}

// Aba "Atividades" de `pts-detalhe.html`; paginação, filtros e as ações de cada
// linha entram com as tasks deles (RFACT002 em diante).
export default function ActivitiesTab({
  ptsId,
  activities,
  error,
  reload,
  canCreate,
  team,
  goals,
  isAdmin,
}: ActivitiesTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  if (error) {
    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>
        <h2>Não foi possível carregar as atividades</h2>
        <p>
          {error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : LOAD_ERROR}
        </p>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={reload}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!activities) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <p>Carregando atividades...</p>
      </div>
    );
  }

  return (
    <>
      {feedback && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{feedback}</span>
        </div>
      )}

      <div className="ux-tcard">
        <div className="ux-tcard-head">
          <div>
            <h2>Atividades</h2>
            <p className="count" aria-live="polite">
              {`${activities.length} ${
                activities.length === 1 ? 'atividade' : 'atividades'
              }`}
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setFeedback('');
                setIsFormOpen(true);
              }}
            >
              <Icon name="plus" className="icon-sm" />
              Nova atividade
            </button>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="activity" className="icon" />
            </div>
            <h2>Nenhuma atividade</h2>
            <p>Este PTS ainda não tem atividades.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Atividade</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Especialidade</th>
                  <th scope="col">Frequência</th>
                  <th scope="col">Status</th>
                  <th scope="col">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="ux-wide">
                      <strong>{activity.title}</strong>
                    </td>
                    <td className="ux-col-lg">
                      {ACTIVITY_TYPE_LABELS[activity.type]}
                    </td>
                    <td>{specialismLabel(activity.specialism)}</td>
                    <td className="nowrap">
                      {formatFrequency(activity.frequency)}
                    </td>
                    <td className="nowrap">
                      <span className={`badge ${activity.status}`}>
                        {ACTIVITY_STATUS_LABELS[activity.status]}
                      </span>
                    </td>
                    <td className="num">{formatDate(activity.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <ActivityFormDialog
          ptsId={ptsId}
          team={team}
          goals={goals}
          isAdmin={isAdmin}
          onCreated={() => {
            setIsFormOpen(false);
            setFeedback('Atividade sugerida');
            reload();
          }}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </>
  );
}
