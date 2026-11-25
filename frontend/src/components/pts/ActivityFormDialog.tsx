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
  VISIT_PLACE_LABELS,
  type ActivityExecutor,
  type ActivityModality,
  type ActivityPeriod,
  type ActivityType,
  type VisitPlace,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import { SPECIALISMS } from '@/lib/professionals';

const SAVE_ERROR = 'Não foi possível criar a atividade';
const FORM_ID = 'activity-new';
// Prefixo próprio: `activity-new-title` é o título do Modal.
const FIELD_ID = `${FORM_ID}-field`;

export type ActivityTeamMember = {
  id: string;
  name: string;
  specialism: string;
};

export type ActivityGoalOption = { id: string; title: string };

type ActivityFormDialogProps = {
  ptsId: string;
  team: ActivityTeamMember[];
  goals: ActivityGoalOption[];
  // Só o admin atribui a autoria (RN029).
  isAdmin: boolean;
  onCreated: () => void;
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

// Modal "Nova atividade" (`act-new` de `pts-detalhe.html`). Monte só com o
// diálogo aberto, para os campos começarem vazios.
export default function ActivityFormDialog({
  ptsId,
  team,
  goals,
  isAdmin,
  onCreated,
  onClose,
}: ActivityFormDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActivityType>('individual_session');
  const [specialism, setSpecialism] = useState<string>('psychologist');
  const [quantity, setQuantity] = useState('1');
  const [period, setPeriod] = useState<ActivityPeriod>('weekly');
  const [duration, setDuration] = useState('45');
  const [modality, setModality] = useState<ActivityModality>('in_person');
  const [visitPlace, setVisitPlace] = useState<VisitPlace>('home');
  const [executor, setExecutor] = useState<ActivityExecutor>('team');
  const [executorIds, setExecutorIds] = useState<string[]>([]);
  const [goalId, setGoalId] = useState('');
  const [description, setDescription] = useState('');
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

    try {
      await createActivity(ptsId, {
        title: title.trim(),
        description: description.trim(),
        type,
        specialism,
        frequency: {
          quantity: quantityValue,
          period,
          durationMinutes: durationValue,
        },
        modality,
        executor,
        ...(modality === 'external_visit' && { visitPlace }),
        ...(executor === 'team' &&
          executorIds.length > 0 && { executorProfessionalIds: executorIds }),
        ...(goalId && { goalId }),
        ...(authorId && { authorProfessionalId: authorId }),
      });

      onCreated();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      const message =
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : SAVE_ERROR;

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
      ? `${FIELD_ID}-frequency-error`
      : undefined,
  };

  return (
    <Modal
      open
      id={FORM_ID}
      title="Nova atividade"
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
            form={FORM_ID}
            className="btn btn-primary"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Salvando...' : 'Sugerir atividade'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {apiError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{apiError}</p>
          </div>
        )}

        <div className="form-grid">
          <FormField
            id={`${FIELD_ID}-title`}
            label="Título"
            error={errors.title}
            full
          >
            <input
              id={`${FIELD_ID}-title`}
              className="input"
              type="text"
              aria-required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={
                errors.title ? `${FIELD_ID}-title-error` : undefined
              }
              disabled={submitting}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField id={`${FIELD_ID}-type`} label="Tipo">
            <select
              id={`${FIELD_ID}-type`}
              className="select"
              aria-required
              disabled={submitting}
              value={type}
              onChange={(event) => setType(event.target.value as ActivityType)}
            >
              {options(ACTIVITY_TYPE_LABELS)}
            </select>
          </FormField>

          <FormField id={`${FIELD_ID}-specialism`} label="Especialidade">
            <select
              id={`${FIELD_ID}-specialism`}
              className="select"
              aria-required
              disabled={submitting}
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
            aria-labelledby={`${FIELD_ID}-frequency-label`}
          >
            <span className="field-label" id={`${FIELD_ID}-frequency-label`}>
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
                id={`${FIELD_ID}-frequency-error`}
                className={ui.fieldError}
                role="alert"
              >
                {errors.frequency}
              </p>
            )}
          </div>

          <FormField id={`${FIELD_ID}-modality`} label="Modalidade">
            <select
              id={`${FIELD_ID}-modality`}
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
              id={`${FIELD_ID}-place`}
              label="Local da visita"
              help="Obrigatório na visita externa."
            >
              <select
                id={`${FIELD_ID}-place`}
                className="select"
                aria-required
                aria-describedby={`${FIELD_ID}-place-tip`}
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

          <FormField id={`${FIELD_ID}-executor`} label="Quem executa">
            <select
              id={`${FIELD_ID}-executor`}
              className="select"
              aria-required
              disabled={submitting}
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
              aria-labelledby={`${FIELD_ID}-executors-label`}
              aria-describedby={`${FIELD_ID}-executors-tip`}
            >
              <span className="ux-labeltip">
                <span
                  className="field-label"
                  id={`${FIELD_ID}-executors-label`}
                >
                  Profissionais executores
                </span>
                <HelpTooltip
                  id={`${FIELD_ID}-executors-tip`}
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
                      disabled={submitting}
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
            id={`${FIELD_ID}-goal`}
            label="Meta"
            help="A meta do PTS que a atividade busca atingir."
            required={false}
            full
          >
            <select
              id={`${FIELD_ID}-goal`}
              className="select"
              aria-describedby={`${FIELD_ID}-goal-tip`}
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
            id={`${FIELD_ID}-description`}
            label="Descrição"
            help="Como a atividade vai ser feita."
            error={errors.description}
            full
          >
            <textarea
              id={`${FIELD_ID}-description`}
              className="input"
              rows={3}
              aria-required
              aria-invalid={Boolean(errors.description)}
              aria-describedby={`${FIELD_ID}-description-tip${
                errors.description ? ` ${FIELD_ID}-description-error` : ''
              }`}
              disabled={submitting}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          {isAdmin && (
            <FormField
              id={`${FIELD_ID}-author`}
              label="Autor"
              help="Profissional da equipe do PTS."
              required={false}
            >
              <select
                id={`${FIELD_ID}-author`}
                className="select"
                aria-describedby={`${FIELD_ID}-author-tip`}
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
