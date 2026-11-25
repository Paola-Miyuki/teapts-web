'use client';

import { Fragment, useState } from 'react';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import Pagination from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDateOnly, todayDateOnly } from '@/lib/format';
import {
  GOAL_AREA_LABELS,
  GOAL_STATUS_BADGES,
  GOAL_STATUS_LABELS,
  GOAL_TERM_LABELS,
  type Goal,
} from '@/lib/goals';

import DeleteGoalDialog from './DeleteGoalDialog';
import GoalFormDialog from './GoalFormDialog';
import GoalViewDialog from './GoalViewDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

const TERM_GROUPS = [
  { key: 'short', label: GOAL_TERM_LABELS.short },
  { key: 'medium', label: GOAL_TERM_LABELS.medium },
  { key: 'long', label: GOAL_TERM_LABELS.long },
  { key: 'none', label: 'Defina o prazo' },
] as const;

type GroupKey = (typeof TERM_GROUPS)[number]['key'];

type OpenDialog =
  { kind: 'add' } | { kind: 'view' | 'edit' | 'delete'; goal: Goal } | null;

type GoalsTabProps = {
  ptsId: string;
  // null enquanto carrega.
  goals: Goal[] | null;
  error: unknown;
  reload: () => void;
  nextReviewAt?: string;
  previousVersion?: number;
  canManage: boolean;
  authors?: { id: string; name: string }[];
};

function groupOf(goal: Goal): GroupKey {
  return goal.term ?? 'none';
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'meta' : 'metas'}`;
}

function TargetDate({ goal }: { goal: Goal }) {
  if (!goal.targetDate) {
    return <>Defina a data-alvo</>;
  }

  const date = formatDateOnly(goal.targetDate);

  return goal.status === 'in_progress' && goal.targetDate < todayDateOnly() ? (
    <span className="ux-overdue" title="Data-alvo vencida e meta em andamento">
      {date}
    </span>
  ) : (
    <>{date}</>
  );
}

// Aba "Metas terapêuticas" (RFPTS012) de `pts-detalhe.html` e `pts.html`.
export default function GoalsTab({
  ptsId,
  goals,
  error,
  reload,
  nextReviewAt,
  previousVersion,
  canManage,
  authors,
}: GoalsTabProps) {
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [collapsed, setCollapsed] = useState<GroupKey[]>([]);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [feedback, setFeedback] = useState('');

  if (error) {
    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>
        <h2>Não foi possível carregar as metas</h2>
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

  if (!goals) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <p>Carregando metas...</p>
      </div>
    );
  }

  const query = term.trim().toLocaleLowerCase('pt-BR');
  const found = TERM_GROUPS.flatMap(({ key }) =>
    goals.filter(
      (goal) =>
        groupOf(goal) === key &&
        goal.title.toLocaleLowerCase('pt-BR').includes(query),
    ),
  );
  const totalPages = Math.max(1, Math.ceil(found.length / limit));
  // A exclusão pode esvaziar a última página.
  const currentPage = Math.min(page, totalPages);
  const shown = found.slice((currentPage - 1) * limit, currentPage * limit);

  function openDialog(next: OpenDialog) {
    setFeedback('');
    setDialog(next);
  }

  function finish(message: string) {
    setDialog(null);
    setFeedback(message);
    reload();
  }

  function toggle(key: GroupKey) {
    setCollapsed((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
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
            <h2>Metas terapêuticas</h2>
            <p className="count" aria-live="polite">
              {countLabel(found.length)}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => openDialog({ kind: 'add' })}
            >
              <Icon name="plus" className="icon-sm" />
              Adicionar meta
            </button>
          )}
        </div>

        <div className="ux-toolbar">
          <label className="field">
            <span>Busca</span>
            <span className="with-icon">
              <Icon name="search" className="icon-sm" />
              <input
                className="input"
                type="search"
                placeholder="Título da meta"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setPage(1);
                }}
              />
            </span>
          </label>
          <div className="ux-tools" />
        </div>

        {shown.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="search" className="icon" />
            </div>
            <h2>Nenhuma meta</h2>
            <p>O PTS precisa de ao menos uma meta.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Meta</th>
                    <th scope="col">Área</th>
                    <th scope="col">Data-alvo</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Atividades</th>
                    <th scope="col" className="actions-col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TERM_GROUPS.map(({ key, label }) => {
                    const rows = shown.filter((goal) => groupOf(goal) === key);

                    if (rows.length === 0) {
                      return null;
                    }

                    const isCollapsed = collapsed.includes(key);

                    return (
                      <Fragment key={key}>
                        <tr className="group-row ux-term-row">
                          <td colSpan={6}>
                            <button
                              type="button"
                              className="ux-term-toggle"
                              aria-expanded={!isCollapsed}
                              onClick={() => toggle(key)}
                            >
                              <Icon name="chevronDown" className="icon" />
                              <span className="ux-term-label">
                                {label}
                              </span>{' '}
                              <span className="ux-term-n">
                                {countLabel(
                                  found.filter((goal) => groupOf(goal) === key)
                                    .length,
                                )}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {rows.map((goal) => (
                          <tr
                            key={goal.id}
                            className={isCollapsed ? 'is-collapsed' : undefined}
                          >
                            <td>
                              <strong>{goal.title}</strong>
                            </td>
                            <td>{GOAL_AREA_LABELS[goal.area]}</td>
                            <td className="num">
                              <TargetDate goal={goal} />
                            </td>
                            <td>
                              <span
                                className={`badge ${GOAL_STATUS_BADGES[goal.status]}`}
                              >
                                {GOAL_STATUS_LABELS[goal.status]}
                              </span>
                            </td>
                            <td className="num">
                              {goal.activitiesCount > 0 ? (
                                <a className="link" href="#atividades">
                                  {goal.activitiesCount}
                                </a>
                              ) : (
                                0
                              )}
                            </td>
                            <td className="actions-col">
                              <KebabMenu label={`Ações para ${goal.title}`}>
                                <li>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() =>
                                      openDialog({ kind: 'view', goal })
                                    }
                                  >
                                    <Icon name="eye" className="icon-sm" />
                                    Visualizar
                                  </button>
                                </li>
                                {canManage && (
                                  <>
                                    <li>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() =>
                                          openDialog({ kind: 'edit', goal })
                                        }
                                      >
                                        <Icon name="edit" className="icon-sm" />
                                        Editar
                                      </button>
                                    </li>
                                    <li>
                                      <div className="sep" />
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="danger"
                                        onClick={() =>
                                          openDialog({ kind: 'delete', goal })
                                        }
                                      >
                                        <Icon
                                          name="trash"
                                          className="icon-sm"
                                        />
                                        Excluir
                                      </button>
                                    </li>
                                  </>
                                )}
                              </KebabMenu>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              limit={limit}
              total={found.length}
              totalPages={totalPages}
              label="Paginação das metas"
              onPageChange={setPage}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      {dialog?.kind === 'view' && (
        <GoalViewDialog
          goal={dialog.goal}
          previousVersion={previousVersion}
          canManage={canManage}
          onEdit={() => openDialog({ kind: 'edit', goal: dialog.goal })}
          onDelete={() => openDialog({ kind: 'delete', goal: dialog.goal })}
          onClose={() => setDialog(null)}
        />
      )}

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <GoalFormDialog
          ptsId={ptsId}
          goal={dialog.kind === 'edit' ? dialog.goal : undefined}
          nextReviewAt={nextReviewAt}
          authors={authors}
          onSaved={() =>
            finish(dialog.kind === 'edit' ? 'Meta salva' : 'Meta adicionada')
          }
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'delete' && (
        <DeleteGoalDialog
          ptsId={ptsId}
          goal={dialog.goal}
          onDeleted={() => finish('Meta excluída')}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
