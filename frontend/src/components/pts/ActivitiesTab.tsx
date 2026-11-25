'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
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

type OpenDialog = { kind: 'add' } | { kind: 'edit'; activity: Activity } | null;

type ActivitiesTabProps = {
  ptsId: string;
  // null enquanto carrega.
  activities: Activity[] | null;
  error: unknown;
  reload: () => void;
  canCreate: boolean;
  // RFACT005 – autor na sugerida, responsável na sugerida ou em andamento,
  // admin (menos rejeitada ou arquivada).
  canEdit: (activity: Activity) => boolean;
  team: ActivityTeamMember[];
  goals: ActivityGoalOption[];
  isAdmin: boolean;
};

function specialismLabel(value: string) {
  return SPECIALISMS.find((item) => item.value === value)?.label ?? value;
}

// Aba "Atividades" de `pts-detalhe.html`; paginação, filtros e as outras ações
// de cada linha entram com as tasks delas (RFACT002 em diante).
export default function ActivitiesTab({
  ptsId,
  activities,
  error,
  reload,
  canCreate,
  canEdit,
  team,
  goals,
  isAdmin,
}: ActivitiesTabProps) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [feedback, setFeedback] = useState('');

  function openDialog(next: Exclude<OpenDialog, null>) {
    setFeedback('');
    setDialog(next);
  }

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
              onClick={() => openDialog({ kind: 'add' })}
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
                  <th scope="col" className="actions-col">
                    <span className="sr-only">Ações</span>
                  </th>
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
                    <td className="actions-col">
                      {canEdit(activity) && (
                        <KebabMenu label={`Ações para ${activity.title}`}>
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() =>
                                openDialog({ kind: 'edit', activity })
                              }
                            >
                              <Icon name="edit" className="icon-sm" />
                              Editar
                            </button>
                          </li>
                        </KebabMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog && (
        <ActivityFormDialog
          ptsId={ptsId}
          activity={dialog.kind === 'edit' ? dialog.activity : undefined}
          team={team}
          goals={goals}
          isAdmin={isAdmin}
          onSaved={() => {
            setDialog(null);
            setFeedback(
              dialog.kind === 'edit' ? 'Atividade salva' : 'Atividade sugerida',
            );
            reload();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
