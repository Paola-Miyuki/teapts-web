'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDateOnly } from '@/lib/format';
import {
  createGoal,
  GOAL_AREA_LABELS,
  GOAL_TERM_LABELS,
  updateGoal,
  type Goal,
  type GoalArea,
  type GoalInput,
  type GoalTerm,
} from '@/lib/goals';

const SAVE_ERROR = 'Não foi possível salvar a meta';

type GoalFormDialogProps = {
  ptsId: string;
  // Meta em edição; sem ela, o diálogo adiciona uma meta.
  goal?: Goal;
  nextReviewAt?: string;
  // Só o admin atribui a autoria, e só ao adicionar (RN029).
  authors?: { id: string; name: string }[];
  onSaved: () => void;
  onClose: () => void;
};

type Values = Omit<GoalInput, 'term'> & { term: GoalTerm | '' };
type Errors = Partial<Record<keyof Values, string>>;

const REQUIRED_MESSAGES: Record<keyof Values, string> = {
  title: 'Informe o título da meta',
  term: 'Informe o prazo',
  area: 'Informe a área',
  description: 'Informe a descrição da meta',
  measureCriterion: 'Informe o critério de medida',
  targetDate: 'Informe a data-alvo',
};

// Modais "Adicionar meta" e "Editar meta" de `pts-detalhe.html`.
export default function GoalFormDialog({
  ptsId,
  goal,
  nextReviewAt,
  authors,
  onSaved,
  onClose,
}: GoalFormDialogProps) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    title: goal?.title ?? '',
    term: goal ? (goal.term ?? '') : 'short',
    area: goal?.area ?? 'communication',
    description: goal?.description ?? '',
    measureCriterion: goal?.measureCriterion ?? '',
    targetDate: goal?.targetDate ?? '',
  });
  const [authorId, setAuthorId] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formId = goal ? 'goal-edit' : 'goal-new';
  // Prefixo próprio: `${formId}-title` é o título do Modal.
  const fieldId = `${formId}-field`;

  function set<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate(): Errors {
    const found: Errors = {};

    for (const field of Object.keys(REQUIRED_MESSAGES) as (keyof Values)[]) {
      if (!values[field].trim()) {
        found[field] = REQUIRED_MESSAGES[field];
      }
    }

    if (nextReviewAt && values.targetDate > nextReviewAt) {
      found.targetDate = `A data-alvo vai até a próxima revisão (${formatDateOnly(nextReviewAt)})`;
    }

    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const found = validate();

    setErrors(found);
    setApiError('');

    if (Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    const input: GoalInput = {
      title: values.title.trim(),
      term: values.term as GoalTerm,
      area: values.area,
      description: values.description.trim(),
      measureCriterion: values.measureCriterion.trim(),
      targetDate: values.targetDate,
    };

    try {
      if (goal) {
        await updateGoal(ptsId, goal.id, input);
      } else {
        await createGoal(ptsId, {
          ...input,
          ...(authorId && { authorProfessionalId: authorId }),
        });
      }

      onSaved();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setApiError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : SAVE_ERROR,
      );
      setSubmitting(false);
    }
  }

  function controlProps(field: keyof Values, hasTip = false) {
    const id = `${fieldId}-${field}`;
    const describedBy = [
      hasTip && `${id}-tip`,
      errors[field] && `${id}-error`,
    ].filter(Boolean);

    return {
      id,
      disabled: submitting,
      'aria-required': true,
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': describedBy.join(' ') || undefined,
    };
  }

  return (
    <Modal
      open
      id={formId}
      size="sm"
      title={goal ? 'Editar meta' : 'Adicionar meta'}
      description={goal ? goal.title : 'Meta terapêutica do PTS'}
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
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting
              ? 'Salvando...'
              : goal
                ? 'Salvar alterações'
                : 'Adicionar meta'}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit}>
        {apiError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{apiError}</p>
          </div>
        )}

        <div className="form-grid">
          <FormField
            id={`${fieldId}-title`}
            label="Meta (título)"
            error={errors.title}
            full
          >
            <input
              {...controlProps('title')}
              className="input"
              type="text"
              value={values.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </FormField>

          <FormField id={`${fieldId}-term`} label="Prazo" error={errors.term}>
            <select
              {...controlProps('term')}
              className="select"
              value={values.term}
              onChange={(event) => set('term', event.target.value as GoalTerm)}
            >
              {values.term === '' && <option value="">Defina o prazo</option>}
              {Object.entries(GOAL_TERM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id={`${fieldId}-area`} label="Área" error={errors.area}>
            <select
              {...controlProps('area')}
              className="select"
              value={values.area}
              onChange={(event) => set('area', event.target.value as GoalArea)}
            >
              {Object.entries(GOAL_AREA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id={`${fieldId}-description`}
            label="Meta (descrição)"
            help="Objetivo SMART: específico, mensurável, alcançável, relevante e com prazo."
            error={errors.description}
            full
          >
            <textarea
              {...controlProps('description', true)}
              className="input"
              rows={2}
              placeholder="O que o paciente vai conseguir fazer"
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </FormField>

          <FormField
            id={`${fieldId}-measureCriterion`}
            label="Critério de medida"
            help="Como a equipe sabe que a meta foi atingida."
            error={errors.measureCriterion}
            full
          >
            <textarea
              {...controlProps('measureCriterion', true)}
              className="input"
              rows={2}
              placeholder="Ex.: 5 pedidos por dia, em 4 de 5 dias"
              value={values.measureCriterion}
              onChange={(event) => set('measureCriterion', event.target.value)}
            />
          </FormField>

          <FormField
            id={`${fieldId}-targetDate`}
            label="Data-alvo"
            help="Até a data máxima do PTS (próxima revisão)."
            error={errors.targetDate}
          >
            <input
              {...controlProps('targetDate', true)}
              className="input"
              type="date"
              max={nextReviewAt}
              value={values.targetDate}
              onChange={(event) => set('targetDate', event.target.value)}
            />
          </FormField>

          {!goal && authors && (
            <FormField
              id={`${fieldId}-author`}
              label="Autor"
              help="Profissional da equipe do PTS."
              required={false}
            >
              <select
                id={`${fieldId}-author`}
                className="select"
                aria-describedby={`${fieldId}-author-tip`}
                disabled={submitting}
                value={authorId}
                onChange={(event) => setAuthorId(event.target.value)}
              >
                <option value="">Sem atribuir (fica com a sua conta)</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      </form>
    </Modal>
  );
}
