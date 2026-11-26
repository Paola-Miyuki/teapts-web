'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDateOnly } from '@/lib/format';
import {
  GOAL_AREA_LABELS,
  GOAL_TERM_LABELS,
  goalOriginLabel,
  type Goal,
} from '@/lib/goals';

import DeleteGoalDialog from './DeleteGoalDialog';
import GoalFormDialog from './GoalFormDialog';

type GoalsStepProps = {
  ptsId: string;
  // null enquanto carrega.
  goals: Goal[] | null;
  error: unknown;
  reload: () => void;
  // Data máxima já salva: é o limite que a API confere.
  nextReviewAt?: string;
  previousVersion?: number;
  priorityNeeds: string[];
  authors?: { id: string; name: string }[];
};

type OpenDialog =
  { kind: 'add' } | { kind: 'edit' | 'delete'; goal: Goal } | null;

// Passo "Metas" de `pts-nova-versao.html`. Cada meta é salva na hora, pelas
// rotas das metas (RFPTS012).
export default function GoalsStep({
  ptsId,
  goals,
  error,
  reload,
  nextReviewAt,
  previousVersion,
  priorityNeeds,
  authors,
}: GoalsStepProps) {
  const [dialog, setDialog] = useState<OpenDialog>(null);

  function finish() {
    setDialog(null);
    reload();
  }

  if (error) {
    return (
      <div className={ui.empty} role="alert">
        <h2>Não foi possível carregar as metas</h2>
        <p>
          {error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : 'Verifique sua conexão e tente novamente.'}
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

  return (
    <div className="ux-wz-cols">
      <div>
        {goals.length === 0 ? (
          <div className="empty">
            <h2>Nenhuma meta</h2>
            <p>O PTS precisa de ao menos uma meta.</p>
          </div>
        ) : (
          <ul className="ux-goals">
            {goals.map((goal) => (
              <li className="ux-goal" key={goal.id} aria-label={goal.title}>
                <div className="ux-goal-top">
                  <span className={`badge ${goal.term ? 'plain' : 'draft'}`}>
                    {goal.term ? GOAL_TERM_LABELS[goal.term] : 'Defina o prazo'}
                  </span>
                  <span className="badge plain">
                    {GOAL_AREA_LABELS[goal.area]}
                  </span>
                  {goal.origin !== 'new' && (
                    <span
                      className={`badge ${
                        goal.origin === 'kept_partial' ? 'partial' : 'not-met'
                      }`}
                    >
                      {goalOriginLabel(goal.origin, previousVersion)}
                    </span>
                  )}
                </div>
                <p className="ux-goal-text">
                  <strong>{goal.title}</strong>
                </p>
                <p className="ux-goal-text">{goal.description}</p>
                <dl className="ux-goal-meta">
                  <div>
                    <dt>Critério de medida</dt>
                    <dd>{goal.measureCriterion}</dd>
                  </div>
                  <div>
                    <dt>Data-alvo</dt>
                    <dd>
                      {goal.targetDate ? (
                        formatDateOnly(goal.targetDate)
                      ) : (
                        <span className="badge draft">Defina a data-alvo</span>
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="ux-goal-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setDialog({ kind: 'edit', goal })}
                  >
                    <Icon name="edit" className="icon-sm" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setDialog({ kind: 'delete', goal })}
                  >
                    <Icon name="trash" className="icon-sm" />
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="heading-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setDialog({ kind: 'add' })}
          >
            <Icon name="plus" className="icon-sm" />
            Incluir meta
          </button>
        </div>
      </div>

      <aside className="ux-card ux-wz-aside">
        <div className="ux-card-head">
          <div>
            <h2>Necessidades prioritárias</h2>
          </div>
        </div>
        {priorityNeeds.length > 0 ? (
          <ol className="ux-ol">
            {priorityNeeds.map((need, index) => (
              <li key={`${index}-${need}`}>{need}</li>
            ))}
          </ol>
        ) : (
          <p className="muted">Não informado</p>
        )}
      </aside>

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <GoalFormDialog
          ptsId={ptsId}
          goal={dialog.kind === 'edit' ? dialog.goal : undefined}
          nextReviewAt={nextReviewAt}
          authors={authors}
          onSaved={finish}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'delete' && (
        <DeleteGoalDialog
          ptsId={ptsId}
          goal={dialog.goal}
          onDeleted={finish}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
