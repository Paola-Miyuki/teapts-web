'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import HelpTooltip from '@/components/HelpTooltip';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import {
  ACTIVITY_EXECUTOR_LABELS,
  ACTIVITY_MODALITY_LABELS,
  ACTIVITY_PERIOD_LABELS,
  ACTIVITY_TYPE_LABELS,
  createActivity,
  updateActivity,
  VISIT_PLACE_LABELS,
  type Activity,
  type ActivityExecutor,
  type ActivityModality,
  type ActivityPeriod,
  type ActivityType,
  type VisitPlace,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import { SPECIALISMS } from '@/lib/professionals';

const CREATE_ERROR = 'Não foi possível criar a atividade';
const UPDATE_ERROR = 'Não foi possível salvar a atividade';

export type ActivityTeamMember = {
  id: string;
  name: string;
  specialism: string;
};

export type ActivityGoalOption = { id: string; title: string };

type ActivityFormDialogProps = {
  ptsId: string;
  // Com a atividade, edita (RFACT005); sem, cria.
  activity?: Activity;
  team: ActivityTeamMember[];
  goals: ActivityGoalOption[];
  // Só o admin atribui a autoria (RN029).
  isAdmin: boolean;
  onSaved: () => void;
  onClose: () => void;
};

type Errors = Partial<Record<'title' | 'description' | 'frequency', string>>;

function positiveInteger(value: string) {
  return /^[1-9]\d*$/.test(value.trim()) ? Number(value) : null;
}

function options(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}

// Modais "Nova atividade" e "Editar atividade" (`act-new` e `act-edit-*` de
// `pts-detalhe.html`). Monte só com o diálogo aberto, para os campos começarem
// vazios ou com os valores da atividade.
export default function ActivityFormDialog({
  ptsId,
  activity,
  team,
  goals,
  isAdmin,
  onSaved,
  onClose,
}: ActivityFormDialogProps) {
  const router = useRouter();
  const isEdit = activity !== undefined;
  const formId = isEdit ? 'activity-edit' : 'activity-new';
  // Prefixo próprio: `${formId}-title` é o título do Modal.
  const fieldId = `${formId}-field`;
  const [title, setTitle] = useState(activity?.title ?? '');
  const [type, setType] = useState<ActivityType>(
    activity?.type ?? 'individual_session',
  );
  const [specialism, setSpecialism] = useState<string>(
    activity?.specialism ?? 'psychologist',
  );
  const [quantity, setQuantity] = useState(
    String(activity?.frequency.quantity ?? 1),
  );
  const [period, setPeriod] = useState<ActivityPeriod>(
    activity?.frequency.period ?? 'weekly',
  );
  const [duration, setDuration] = useState(
    String(activity?.frequency.durationMinutes ?? 45),
  );
  const [modality, setModality] = useState<ActivityModality>(
    activity?.modality ?? 'in_person',
  );
  const [visitPlace, setVisitPlace] = useState<VisitPlace>(
    activity?.visitPlace ?? 'home',
  );
  const [executor, setExecutor] = useState<ActivityExecutor>(
    activity?.executor ?? 'team',
  );
  const [executorIds, setExecutorIds] = useState<string[]>(
    activity?.executorProfessionalIds ?? [],
  );
  const [goalId, setGoalId] = useState(activity?.goalId ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [authorId, setAuthorId] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleExecutor(id: string) {
    setExecutorIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const quantityValue = positiveInteger(quantity);
    const durationValue = positiveInteger(duration);
    const found: Errors = {
      ...(!title.trim() && { title: 'Informe o título da atividade' }),
      ...(!description.trim() && {
        description: 'Informe a descrição da atividade',
      }),
      ...((!quantityValue || !durationValue) && {
        frequency: 'Informe quantidade, período e duração',
      }),
    };

    setErrors(found);
    setApiError('');

    if (!quantityValue || !durationValue || Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    const fields = {
      title: title.trim(),
      description: description.trim(),
      type,
      frequency: {
        quantity: quantityValue,
        period,
        durationMinutes: durationValue,
      },
      modality,
      ...(modality === 'external_visit' && { visitPlace }),
    };

    try {
      if (activity) {
        // Especialidade, quem executa e autoria não mudam na edição; sem
        // documentIds, os documentos ficam como estão.
        await updateActivity(activity.id, {
          ...fields,
          goalId: goalId || null,
        });
      } else {
        await createActivity(ptsId, {
          ...fields,
          specialism,
          executor,
          ...(executor === 'team' &&
            executorIds.length > 0 && {
              executorProfessionalIds: executorIds,
            }),
          ...(goalId && { goalId }),
          ...(authorId && { authorProfessionalId: authorId }),
        });
      }

      onSaved();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      const message =
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : isEdit
            ? UPDATE_ERROR
            : CREATE_ERROR;

      if (failure instanceof ApiError && failure.status === 422) {
        setErrors({ frequency: message });
      } else {
        setApiError(message);
      }

      setSubmitting(false);
    }
  }

  const frequencyProps = {
    disabled: submitting,
    'aria-required': true,
    'aria-invalid': Boolean(errors.frequency),
    'aria-describedby': errors.frequency
      ? `${fieldId}-frequency-error`
      : undefined,
  };

  return (
    <Modal
      open
      id={formId}
      title={isEdit ? 'Editar atividade' : 'Nova atividade'}
      description={activity?.title}
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
              : isEdit
                ? 'Salvar alterações'
                : 'Sugerir atividade'}
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
            label="Título"
            error={errors.title}
            full
          >
            <input
              id={`${fieldId}-title`}
              className="input"
              type="text"
              aria-required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={
                errors.title ? `${fieldId}-title-error` : undefined
              }
              disabled={submitting}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField id={`${fieldId}-type`} label="Tipo">
            <select
              id={`${fieldId}-type`}
              className="select"
              aria-required
              disabled={submitting}
              value={type}
              onChange={(event) => setType(event.target.value as ActivityType)}
            >
              {options(ACTIVITY_TYPE_LABELS)}
            </select>
          </FormField>

          <FormField id={`${fieldId}-specialism`} label="Especialidade">
            <select
              id={`${fieldId}-specialism`}
              className="select"
              aria-required
              disabled={submitting || isEdit}
              value={specialism}
              onChange={(event) => setSpecialism(event.target.value)}
            >
              {SPECIALISMS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <div
            className="field full"
            role="group"
            aria-labelledby={`${fieldId}-frequency-label`}
          >
            <span className="field-label" id={`${fieldId}-frequency-label`}>
              Frequência
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </span>
            <div className="ux-freq">
              <input
                {...frequencyProps}
                className="input"
                aria-label="Quantidade"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <span>x</span>
              <select
                className="select"
                aria-label="Período"
                disabled={submitting}
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value as ActivityPeriod)
                }
              >
                {options(ACTIVITY_PERIOD_LABELS)}
              </select>
              <input
                {...frequencyProps}
                className="input"
                aria-label="Duração em minutos"
                inputMode="numeric"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
              <span>min</span>
            </div>
            {errors.frequency && (
              <p
                id={`${fieldId}-frequency-error`}
                className={ui.fieldError}
                role="alert"
              >
                {errors.frequency}
              </p>
            )}
          </div>

          <FormField id={`${fieldId}-modality`} label="Modalidade">
            <select
              id={`${fieldId}-modality`}
              className="select"
              aria-required
              disabled={submitting}
              value={modality}
              onChange={(event) =>
                setModality(event.target.value as ActivityModality)
              }
            >
              {options(ACTIVITY_MODALITY_LABELS)}
            </select>
          </FormField>

          {modality === 'external_visit' && (
            <FormField
              id={`${fieldId}-place`}
              label="Local da visita"
              help="Obrigatório na visita externa."
            >
              <select
                id={`${fieldId}-place`}
                className="select"
                aria-required
                aria-describedby={`${fieldId}-place-tip`}
                disabled={submitting}
                value={visitPlace}
                onChange={(event) =>
                  setVisitPlace(event.target.value as VisitPlace)
                }
              >
                {options(VISIT_PLACE_LABELS)}
              </select>
            </FormField>
          )}

          <FormField id={`${fieldId}-executor`} label="Quem executa">
            <select
              id={`${fieldId}-executor`}
              className="select"
              aria-required
              disabled={submitting || isEdit}
              value={executor}
              onChange={(event) =>
                setExecutor(event.target.value as ActivityExecutor)
              }
            >
              {options(ACTIVITY_EXECUTOR_LABELS)}
            </select>
          </FormField>

          {executor === 'team' && (
            <div
              className="field full"
              role="group"
              aria-labelledby={`${fieldId}-executors-label`}
              aria-describedby={`${fieldId}-executors-tip`}
            >
              <span className="ux-labeltip">
                <span className="field-label" id={`${fieldId}-executors-label`}>
                  Profissionais executores
                </span>
                <HelpTooltip
                  id={`${fieldId}-executors-tip`}
                  label="Profissionais executores"
                >
                  Mais de um em co-terapia; vazio, vale o autor.
                </HelpTooltip>
              </span>
              <div className="ux-picks">
                {team.map((member) => (
                  <label className="ux-pick" key={member.id}>
                    <input
                      type="checkbox"
                      disabled={submitting || isEdit}
                      checked={executorIds.includes(member.id)}
                      onChange={() => toggleExecutor(member.id)}
                    />
                    <span>
                      <strong>{member.name}</strong>
                      <small>{member.specialism}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <FormField
            id={`${fieldId}-goal`}
            label="Meta"
            help="A meta do PTS que a atividade busca atingir."
            required={false}
            full
          >
            <select
              id={`${fieldId}-goal`}
              className="select"
              aria-describedby={`${fieldId}-goal-tip`}
              disabled={submitting}
              value={goalId}
              onChange={(event) => setGoalId(event.target.value)}
            >
              <option value="">Sem meta</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id={`${fieldId}-description`}
            label="Descrição"
            help="Como a atividade vai ser feita."
            error={errors.description}
            full
          >
            <textarea
              id={`${fieldId}-description`}
              className="input"
              rows={3}
              aria-required
              aria-invalid={Boolean(errors.description)}
              aria-describedby={`${fieldId}-description-tip${
                errors.description ? ` ${fieldId}-description-error` : ''
              }`}
              disabled={submitting}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          {isAdmin && !isEdit && (
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
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {`${member.name}, ${member.specialism}`}
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
