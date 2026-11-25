'use client';

import { useState } from 'react';

import Icon, { type IconName } from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import {
  ACTIVITY_EXECUTOR_LABELS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  archiveActivity,
  changeActivityStatus,
  formatFrequency,
  type ActivityExecutor,
  type ActivityPagination,
  type ActivityStatus,
  type Activity,
  type ActivityStatusAction,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { SPECIALISMS } from '@/lib/professionals';

import ActivityFormDialog, {
  type ActivityGoalOption,
  type ActivityTeamMember,
} from './ActivityFormDialog';
import ActivityViewDialog from './ActivityViewDialog';
import ConfirmActivityDialog from './ConfirmActivityDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

const STATUS_OPTIONS = Object.entries(ACTIVITY_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const EXECUTOR_OPTIONS = Object.entries(ACTIVITY_EXECUTOR_LABELS);

const STATUS_ACTIONS: Record<
  ActivityStatusAction,
  {
    label: string;
    icon: IconName;
    description: string;
    busyLabel: string;
    errorMessage: string;
    done: string;
  }
> = {
  approve: {
    label: 'Aprovar',
    icon: 'check',
    description:
      'A atividade passa para Em andamento e já pode receber atendimentos.',
    busyLabel: 'Aprovando...',
    errorMessage: 'Não foi possível aprovar a atividade',
    done: 'Atividade aprovada',
  },
  reject: {
    label: 'Rejeitar',
    icon: 'close',
    description: 'A atividade não entra no plano. O motivo fica na timeline.',
    busyLabel: 'Rejeitando...',
    errorMessage: 'Não foi possível rejeitar a atividade',
    done: 'Atividade rejeitada',
  },
  suspend: {
    label: 'Suspender',
    icon: 'clock',
    description:
      'A atividade para de receber atendimentos até ser retomada. O motivo fica na timeline.',
    busyLabel: 'Suspendendo...',
    errorMessage: 'Não foi possível suspender a atividade',
    done: 'Atividade suspensa',
  },
  resume: {
    label: 'Retomar',
    icon: 'check',
    description: 'A atividade volta para Em andamento.',
    busyLabel: 'Retomando...',
    errorMessage: 'Não foi possível retomar a atividade',
    done: 'Atividade retomada',
  },
  conclude: {
    label: 'Concluir',
    icon: 'checkCircle',
    description:
      'A atividade sai do plano em andamento. Os atendimentos continuam no histórico.',
    busyLabel: 'Concluindo...',
    errorMessage: 'Não foi possível concluir a atividade',
    done: 'Atividade concluída',
  },
};

type OpenDialog =
  | { kind: 'add' }
  | { kind: 'view' | 'edit' | 'archive'; activity: Activity }
  | { kind: 'status'; action: ActivityStatusAction; activity: Activity }
  | null;

type ActivitiesTabProps = {
  ptsId: string;
  // null enquanto carrega.
  activities: Activity[] | null;
  pagination: ActivityPagination | null;
  error: unknown;
  reload: () => void;
  canCreate: boolean;
  // RFACT005 – autor na sugerida, responsável na sugerida ou em andamento,
  // admin (menos rejeitada ou arquivada).
  canEdit: (activity: Activity) => boolean;
  // RFACT008 – equipe e admin, na sugerida, em andamento ou suspensa.
  canArchive: (activity: Activity) => boolean;
  // RFACT009 – equipe e admin, conforme o estado da atividade.
  canChangeStatus: (
    activity: Activity,
    action: ActivityStatusAction,
  ) => boolean;
  team: ActivityTeamMember[];
  goals: ActivityGoalOption[];
  isAdmin: boolean;
  // Vazio vale como "Todos", igual aos outros filtros.
  statusFilter: ActivityStatus[];
  onStatusFilterChange: (status: ActivityStatus[]) => void;
  executorFilter: ActivityExecutor | undefined;
  onExecutorFilterChange: (executor: ActivityExecutor | undefined) => void;
  onClearFilters: () => void;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

function specialismLabel(value: string) {
  return SPECIALISMS.find((item) => item.value === value)?.label ?? value;
}

// Aba "Atividades" de `pts-detalhe.html` (RFACT002). Busca, ordenação e o filtro
// de tipo ainda não existem na API.
export default function ActivitiesTab({
  ptsId,
  activities,
  pagination,
  error,
  reload,
  canCreate,
  canEdit,
  canArchive,
  canChangeStatus,
  team,
  goals,
  isAdmin,
  statusFilter,
  onStatusFilterChange,
  executorFilter,
  onExecutorFilterChange,
  onClearFilters,
  page,
  limit,
  onPageChange,
  onLimitChange,
}: ActivitiesTabProps) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [feedback, setFeedback] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  if (!activities || !pagination) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <p>Carregando atividades...</p>
      </div>
    );
  }

  function finish(message: string) {
    setDialog(null);
    setFeedback(message);
    reload();
  }

  const statusActions = (activity: Activity) =>
    (Object.keys(STATUS_ACTIONS) as ActivityStatusAction[]).filter((action) =>
      canChangeStatus(activity, action),
    );

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
              {`${pagination.total} ${
                pagination.total === 1 ? 'atividade' : 'atividades'
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
            <button type="button" className="btn" onClick={onClearFilters}>
              <Icon name="close" className="icon-sm" />
              Limpar
            </button>
          </div>
        </div>

        <div className="filter-more" id="acts-more" hidden={!filtersOpen}>
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(values) =>
              onStatusFilterChange(values as ActivityStatus[])
            }
          />
          <div className="field">
            <label className="field-label" htmlFor="acts-executor">
              Quem executa
            </label>
            <select
              className="select"
              id="acts-executor"
              value={executorFilter ?? ''}
              onChange={(event) =>
                onExecutorFilterChange(
                  (event.target.value || undefined) as
                    ActivityExecutor | undefined,
                )
              }
            >
              <option value="">Todos</option>
              {EXECUTOR_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="activity" className="icon" />
            </div>
            <h2>
              {pagination.total === 0
                ? 'Nenhuma atividade'
                : 'Nenhuma atividade nesta página'}
            </h2>
            <p>
              {pagination.total === 0
                ? 'Este PTS ainda não tem atividades para os filtros selecionados.'
                : 'Altere a página ou os filtros para ver outras atividades.'}
            </p>
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
                      <KebabMenu label={`Ações para ${activity.title}`}>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              openDialog({ kind: 'view', activity })
                            }
                          >
                            <Icon name="eye" className="icon-sm" />
                            Visualizar
                          </button>
                        </li>
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
                        {statusActions(activity).map((action) => (
                          <li key={action}>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() =>
                                openDialog({
                                  kind: 'status',
                                  action,
                                  activity,
                                })
                              }
                            >
                              <Icon
                                name={STATUS_ACTIONS[action].icon}
                                className="icon-sm"
                              />
                              {STATUS_ACTIONS[action].label}
                            </button>
                          </li>
                        ))}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.total > 0 && (
          <Pagination
            page={page}
            limit={limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            label="Paginação das atividades"
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
          />
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

      {dialog?.kind === 'status' && (
        <ConfirmActivityDialog
          title={`${STATUS_ACTIONS[dialog.action].label} ${dialog.activity.title}?`}
          description={STATUS_ACTIONS[dialog.action].description}
          confirmLabel={`${STATUS_ACTIONS[dialog.action].label} atividade`}
          busyLabel={STATUS_ACTIONS[dialog.action].busyLabel}
          errorMessage={STATUS_ACTIONS[dialog.action].errorMessage}
          danger={['reject', 'suspend'].includes(dialog.action)}
          askReason={['reject', 'suspend'].includes(dialog.action)}
          onConfirm={(reason) =>
            changeActivityStatus(dialog.activity.id, dialog.action, reason)
          }
          onDone={() => finish(STATUS_ACTIONS[dialog.action].done)}
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

      {dialog?.kind === 'view' && (
        <ActivityViewDialog
          key={dialog.activity.id}
          activityId={dialog.activity.id}
          team={team}
          actions={
            <>
              {canEdit(dialog.activity) && (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    openDialog({ kind: 'edit', activity: dialog.activity })
                  }
                >
                  <Icon name="edit" className="icon-sm" />
                  Editar
                </button>
              )}
              {statusActions(dialog.activity).map((action) => (
                <button
                  key={action}
                  type="button"
                  className="btn"
                  onClick={() =>
                    openDialog({
                      kind: 'status',
                      action,
                      activity: dialog.activity,
                    })
                  }
                >
                  <Icon
                    name={STATUS_ACTIONS[action].icon}
                    className="icon-sm"
                  />
                  {STATUS_ACTIONS[action].label}
                </button>
              ))}
            </>
          }
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
