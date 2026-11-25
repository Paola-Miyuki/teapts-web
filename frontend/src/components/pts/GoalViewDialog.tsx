import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import { formatDate, formatDateOnly } from '@/lib/format';
import {
  GOAL_AREA_LABELS,
  GOAL_ORIGIN_LABELS,
  GOAL_STATUS_BADGES,
  GOAL_STATUS_LABELS,
  GOAL_TERM_LABELS,
  type Goal,
} from '@/lib/goals';

type GoalViewDialogProps = {
  goal: Goal;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

// Modal Visualizar da meta (`goal-view` de `pts-detalhe.html` e `pts.html`).
export default function GoalViewDialog({
  goal,
  canManage,
  onEdit,
  onDelete,
  onClose,
}: GoalViewDialogProps) {
  return (
    <Modal
      open
      id="goal-view"
      title={goal.title}
      onClose={onClose}
      footer={
        <>
          {canManage && (
            <button
              type="button"
              className="btn spacer btn-danger"
              onClick={onDelete}
            >
              <Icon name="trash" className="icon-sm" />
              Excluir
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              <Icon name="edit" className="icon-sm" />
              Editar
            </button>
          )}
        </>
      }
    >
      <dl className="data-grid">
        <div>
          <dt>Prazo</dt>
          <dd>{goal.term ? GOAL_TERM_LABELS[goal.term] : 'Defina o prazo'}</dd>
        </div>
        <div>
          <dt>Área</dt>
          <dd>{GOAL_AREA_LABELS[goal.area]}</dd>
        </div>
        <div>
          <dt>Data-alvo</dt>
          <dd>
            {goal.targetDate
              ? formatDateOnly(goal.targetDate)
              : 'Defina a data-alvo'}
          </dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            <span className={`badge ${GOAL_STATUS_BADGES[goal.status]}`}>
              {GOAL_STATUS_LABELS[goal.status]}
            </span>
          </dd>
        </div>
        <div>
          <dt>Origem</dt>
          <dd>{GOAL_ORIGIN_LABELS[goal.origin]}</dd>
        </div>
        <div>
          <dt>Resultado</dt>
          <dd>
            {goal.status === 'in_progress'
              ? 'Marcado na reavaliação do fim do ciclo'
              : (goal.resultNote ?? 'Sem observação')}
          </dd>
        </div>
        <div className="full">
          <dt>Meta</dt>
          <dd>{goal.description}</dd>
        </div>
        <div className="full">
          <dt>Critério de medida</dt>
          <dd>{goal.measureCriterion}</dd>
        </div>
        <div>
          <dt>Registrada por</dt>
          <dd>
            {`${goal.registeredBy.name}, em ${formatDate(goal.createdAt)}`}
          </dd>
        </div>
        <div>
          <dt>Atividades ligadas</dt>
          <dd>{goal.activitiesCount}</dd>
        </div>
      </dl>
    </Modal>
  );
}
