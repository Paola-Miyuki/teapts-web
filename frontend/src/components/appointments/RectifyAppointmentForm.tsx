'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import SoapFields, { SOAP_FIELDS } from '@/components/appointments/SoapFields';
import FormField from '@/components/FormField';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import {
  ACTIVITY_MODALITY_LABELS,
  VISIT_PLACE_LABELS,
  type ActivityModality,
  type VisitPlace,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import {
  ATTENDANCE_LABELS,
  rectifyAppointment,
  type AppointmentDetails,
  type Attendance,
  type SoapInput,
} from '@/lib/appointments';
import { formatDateOnly, todayDateOnly } from '@/lib/format';

const SAVE_ERROR = 'Não foi possível registrar a retificação';

type Form = SoapInput & {
  reason: string;
  appointmentDate: string;
  attendance: Attendance;
  startTime: string;
  endTime: string;
  modality: ActivityModality;
  visitPlace: VisitPlace | '';
  absenceReason: string;
};

type Errors = Partial<Record<keyof Form, string>>;

// Na ordem da tela, para o foco ir ao primeiro erro.
const FIELD_IDS: Partial<Record<keyof Form, string>> = {
  reason: 'rectify-reason',
  appointmentDate: 'rectify-date',
  startTime: 'rectify-start',
  endTime: 'rectify-end',
  visitPlace: 'rectify-place',
  soapSubjective: 'appointment-soapSubjective',
  soapObjective: 'appointment-soapObjective',
  soapAssessment: 'appointment-soapAssessment',
  soapPlan: 'appointment-soapPlan',
};

// Mesmas regras do registro (RFACT004), mais a justificativa (RFACT007).
function validate(form: Form): Errors {
  const errors: Errors = {};
  const done = form.attendance === 'done';

  if (!form.reason.trim()) {
    errors.reason = 'Informe a justificativa da retificação';
  }
  if (!form.appointmentDate) {
    errors.appointmentDate = 'Informe a data do atendimento';
  } else if (
    form.attendance !== 'cancelled' &&
    form.appointmentDate > todayDateOnly()
  ) {
    errors.appointmentDate = 'A data não pode ser futura';
  }
  if (!form.startTime) errors.startTime = 'Informe a hora de início';
  if (done && !form.endTime) {
    errors.endTime = 'Informe a hora de término';
  } else if (done && form.endTime <= form.startTime) {
    errors.endTime = 'A hora de término precisa ser depois da de início';
  }
  if (form.modality === 'external_visit' && !form.visitPlace) {
    errors.visitPlace = 'Informe o local da visita';
  }

  if (done) {
    for (const { key, error } of SOAP_FIELDS) {
      if (!form[key].trim()) errors[key] = error;
    }
  }

  return errors;
}

// Modal "Retificar atendimento" de `atendimentos.html` (RFACT007): os campos
// vêm preenchidos com a versão mais nova, e a justificativa é obrigatória.
export default function RectifyAppointmentForm({
  appointment,
  onCancel,
  onRectified,
}: {
  appointment: AppointmentDetails;
  onCancel: () => void;
  onRectified: () => void;
}) {
  const router = useRouter();
  const latest =
    appointment.rectifications[appointment.rectifications.length - 1] ??
    appointment;
  const [form, setForm] = useState<Form>({
    reason: '',
    appointmentDate: latest.appointmentDate,
    attendance: latest.attendance,
    startTime: latest.startTime,
    endTime: latest.endTime ?? '',
    modality: latest.modality,
    visitPlace: latest.visitPlace ?? '',
    soapSubjective: latest.soap?.subjective ?? '',
    soapObjective: latest.soap?.objective ?? '',
    soapAssessment: latest.soap?.assessment ?? '',
    soapPlan: latest.soap?.plan ?? '',
    absenceReason: latest.absenceReason ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const done = form.attendance === 'done';

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  async function submit() {
    if (submitting) {
      return;
    }

    const found = validate(form);

    setErrors(found);

    const first = (Object.keys(FIELD_IDS) as (keyof Form)[]).find(
      (key) => found[key],
    );

    if (first) {
      document.getElementById(FIELD_IDS[first]!)?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await rectifyAppointment(
        appointment.rectifiesAppointmentId ?? appointment.id,
        {
          reason: form.reason.trim(),
          appointmentDate: form.appointmentDate,
          startTime: form.startTime,
          modality: form.modality,
          attendance: form.attendance,
          ...(form.modality === 'external_visit' &&
            form.visitPlace && { visitPlace: form.visitPlace }),
          ...(done
            ? {
                endTime: form.endTime,
                soapSubjective: form.soapSubjective.trim(),
                soapObjective: form.soapObjective.trim(),
                soapAssessment: form.soapAssessment.trim(),
                soapPlan: form.soapPlan.trim(),
              }
            : form.absenceReason.trim() && {
                absenceReason: form.absenceReason.trim(),
              }),
        },
      );

      onRectified();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      setSubmitError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : SAVE_ERROR,
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      id="appointment-rectify"
      icon="edit"
      title="Retificar atendimento"
      description={`${formatDateOnly(appointment.appointmentDate)}, ${appointment.activity.title}`}
      busy={submitting}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="appointment-rectify-form"
            className="btn btn-primary"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Registrando...' : 'Registrar retificação'}
          </button>
        </>
      }
    >
      <form
        id="appointment-rectify-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {submitError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <div className={ui.alertIcon}>
              <Icon name="alertCircle" />
            </div>
            <span>{submitError}</span>
          </div>
        )}

        <p className="muted">
          O registro original não muda: a retificação fica guardada junto dele.
        </p>

        <div className="form-grid">
          <FormField
            id="rectify-reason"
            label="Justificativa da retificação"
            error={errors.reason}
            full
          >
            <textarea
              className="input"
              id="rectify-reason"
              rows={2}
              aria-required="true"
              aria-invalid={Boolean(errors.reason)}
              value={form.reason}
              onChange={(event) => update('reason', event.target.value)}
            />
          </FormField>

          <FormField
            id="rectify-date"
            label="Data do atendimento"
            error={errors.appointmentDate}
          >
            <input
              className="input"
              id="rectify-date"
              type="date"
              aria-required="true"
              aria-invalid={Boolean(errors.appointmentDate)}
              value={form.appointmentDate}
              onChange={(event) =>
                update('appointmentDate', event.target.value)
              }
            />
          </FormField>

          <FormField id="rectify-attendance" label="Comparecimento">
            <select
              className="select"
              id="rectify-attendance"
              aria-required="true"
              value={form.attendance}
              onChange={(event) => {
                setErrors({});
                update('attendance', event.target.value as Attendance);
              }}
            >
              {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="rectify-start"
            label="Hora de início"
            error={errors.startTime}
          >
            <input
              className="input"
              id="rectify-start"
              type="time"
              aria-required="true"
              aria-invalid={Boolean(errors.startTime)}
              value={form.startTime}
              onChange={(event) => update('startTime', event.target.value)}
            />
          </FormField>

          {done && (
            <FormField
              id="rectify-end"
              label="Hora de término"
              error={errors.endTime}
            >
              <input
                className="input"
                id="rectify-end"
                type="time"
                aria-required="true"
                aria-invalid={Boolean(errors.endTime)}
                value={form.endTime}
                onChange={(event) => update('endTime', event.target.value)}
              />
            </FormField>
          )}

          <FormField id="rectify-modality" label="Modalidade">
            <select
              className="select"
              id="rectify-modality"
              aria-required="true"
              value={form.modality}
              onChange={(event) =>
                update('modality', event.target.value as ActivityModality)
              }
            >
              {Object.entries(ACTIVITY_MODALITY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </FormField>

          {form.modality === 'external_visit' && (
            <FormField
              id="rectify-place"
              label="Local da visita"
              error={errors.visitPlace}
            >
              <select
                className="select"
                id="rectify-place"
                aria-required="true"
                aria-invalid={Boolean(errors.visitPlace)}
                value={form.visitPlace}
                onChange={(event) =>
                  update('visitPlace', event.target.value as VisitPlace)
                }
              >
                <option value="">Selecione o local</option>
                {Object.entries(VISIT_PLACE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {!done && (
            <FormField
              id="rectify-absence"
              label="Motivo da falta ou da desmarcação"
              required={false}
              full
            >
              <textarea
                className="input"
                id="rectify-absence"
                rows={2}
                value={form.absenceReason}
                onChange={(event) =>
                  update('absenceReason', event.target.value)
                }
              />
            </FormField>
          )}
        </div>

        {done && <SoapFields values={form} errors={errors} onChange={update} />}
      </form>
    </Modal>
  );
}
