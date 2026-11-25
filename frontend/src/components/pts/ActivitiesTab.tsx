'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import ui from '@/components/ui.module.css';
import {
  ACTIVE_ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  archiveActivity,
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
import ConfirmActivityDialog from './ConfirmActivityDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

type OpenDialog =
  { kind: 'add' } | { kind: 'edit' | 'archive'; activity: Activity } | null;

const STATUS_OPTIONS = Object.entries(ACTIVITY_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

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
  // RFACT008 – equipe e admin, na sugerida, em andamento ou suspensa.
  canArchive: (activity: Activity) => boolean;
  team: ActivityTeamMember[];
  goals: ActivityGoalOption[];
  isAdmin: boolean;
};

function specialismLabel(value: string) {
  return SPECIALISMS.find((item) => item.value === value)?.label ?? value;
}

// Aba "Atividades" de `pts-detalhe.html`. Por padrão mostra só o que faz parte
// do plano; a arquivada aparece marcando "Arquivada" no filtro de status. Busca,
// ordenação, paginação, os outros filtros e as outras ações de cada linha
// entram com as tasks delas.
export default function ActivitiesTab({
  ptsId,
  activities,
  error,
  reload,
  canCreate,
  canEdit,
  canArchive,
  team,
  goals,
  isAdmin,
}: ActivitiesTabProps) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [feedback, setFeedback] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statuses, setStatuses] = useState<string[]>(ACTIVE_ACTIVITY_STATUSES);

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

  // Nenhum status marcado vale como "Todos", igual aos outros filtros.
  const shown =
    statuses.length === 0
      ? activities
      : activities.filter((activity) => statuses.includes(activity.status));

  function finish(message: string) {
    setDialog(null);
    setFeedback(message);
    reload();
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
              {`${shown.length} ${
                shown.length === 1 ? 'atividade' : 'atividades'
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

        <div className="ux-toolbar">
          <div className="ux-tools">
            <button
              type="button"
              className="btn filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="acts-more"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Icon name="filter" className="icon-sm" />
              Filtros
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setStatuses(ACTIVE_ACTIVITY_STATUSES)}
            >
              <Icon name="close" className="icon-sm" />
              Limpar
            </button>
          </div>
        </div>

        <div className="filter-more" id="acts-more" hidden={!filtersOpen}>
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            value={statuses}
            onChange={setStatuses}
          />
        </div>

        {activities.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="activity" className="icon" />
            </div>
            <h2>Nenhuma atividade</h2>
            <p>Este PTS ainda não tem atividades.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="search" className="icon" />
            </div>
            <h2>Nenhuma atividade encontrada</h2>
            <p>Revise os filtros.</p>
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
                {shown.map((activity) => (
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
                      {(canEdit(activity) || canArchive(activity)) && (
                        <KebabMenu label={`Ações para ${activity.title}`}>
                          {canEdit(activity) && (
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
                          )}
                          {canArchive(activity) && (
                            <li>
                              <div className="sep" />
                              <button
                                type="button"
                                role="menuitem"
                                className="danger"
                                onClick={() =>
                                  openDialog({ kind: 'archive', activity })
                                }
                              >
                                <Icon name="lock" className="icon-sm" />
                                Arquivar
                              </button>
                            </li>
                          )}
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

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <ActivityFormDialog
          ptsId={ptsId}
          activity={dialog.kind === 'edit' ? dialog.activity : undefined}
          team={team}
          goals={goals}
          isAdmin={isAdmin}
          onSaved={() =>
            finish(
              dialog.kind === 'edit' ? 'Atividade salva' : 'Atividade sugerida',
            )
          }
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'archive' && (
        <ConfirmActivityDialog
          title={`Arquivar ${dialog.activity.title}?`}
          description="A atividade sai do plano. Os atendimentos já registrados continuam no histórico."
          confirmLabel="Arquivar atividade"
          busyLabel="Arquivando..."
          errorMessage="Não foi possível arquivar a atividade"
          onConfirm={(reason) => archiveActivity(dialog.activity.id, reason)}
          onDone={() => finish('Atividade arquivada')}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
