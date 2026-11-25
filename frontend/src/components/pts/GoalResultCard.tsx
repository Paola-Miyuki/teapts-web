import FormField from '@/components/FormField';
import { formatDateOnly } from '@/lib/format';
import { GOAL_AREA_LABELS, GOAL_TERM_LABELS, type Goal } from '@/lib/goals';
import type { GoalResult } from '@/lib/pts';

export const GOAL_RESULT_OPTIONS: {
  value: GoalResult;
  label: string;
  className: string;
}[] = [
  { value: 'achieved', label: 'Atingida', className: 'ux-seg-done' },
  {
    value: 'partially_achieved',
    label: 'Parcialmente atingida',
    className: 'ux-seg-partial',
  },
  { value: 'not_achieved', label: 'Não atingida', className: 'ux-seg-missed' },
];

type GoalResultCardProps = {
  goal: Goal;
  result?: GoalResult;
  note: string;
  disabled?: boolean;
  onResultChange: (result: GoalResult) => void;
  onNoteChange: (note: string) => void;
};

// Meta no passo "Resultado das metas" de `reavaliacao.html`: o que foi
// combinado, o resultado e a observação opcional.
export default function GoalResultCard({
  goal,
  result,
  note,
  disabled = false,
  onResultChange,
  onNoteChange,
}: GoalResultCardProps) {
  const noteId = `rv-obs-${goal.id}`;

  return (
    <li className="ux-goal ux-rv-goal" aria-label={goal.title}>
      <div className="ux-goal-top">
        {goal.term && (
          <span className="badge plain">{GOAL_TERM_LABELS[goal.term]}</span>
        )}
        <span className="badge plain">{GOAL_AREA_LABELS[goal.area]}</span>
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
          <dd>{goal.targetDate ? formatDateOnly(goal.targetDate) : '—'}</dd>
        </div>
      </dl>

      <fieldset className="ux-seg ux-rv-result">
        <legend className="ux-rv-label">Resultado</legend>
        {GOAL_RESULT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`ux-seg-opt ${option.className}`}
          >
            <input
              type="radio"
              name={`rv-goal-${goal.id}`}
              value={option.value}
              checked={result === option.value}
              disabled={disabled}
              onChange={() => onResultChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <FormField id={noteId} label="Observação" required={false}>
        <input
          className="input"
          id={noteId}
          placeholder="Ex.: pede ajuda sozinha em casa, ainda não na escola"
          disabled={disabled}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </FormField>
    </li>
  );
}
