'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import SoapFields, { SOAP_FIELDS } from '@/components/appointments/SoapFields';
import Combobox from '@/components/Combobox';
import FormField from '@/components/FormField';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { Account } from '@/lib/account';
import {
  ACTIVITY_MODALITY_LABELS,
  formatFrequency,
  getActivities,
  VISIT_PLACE_LABELS,
  type Activity,
  type ActivityModality,
  type VisitPlace,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import {
  ATTENDANCE_LABELS,
  createAppointment,
  type Attendance,
  type SoapInput,
} from '@/lib/appointments';
import { todayDateOnly } from '@/lib/format';
import { getGoals, type Goal } from '@/lib/goals';
import { getPatients, type PatientListItem } from '@/lib/patients';
import { can } from '@/lib/permissions';
import { SPECIALISMS } from '@/lib/professionals';
import { getPts, getPtsStatusLabel, type PtsDetail } from '@/lib/pts';

const LOAD_ERROR = 'Não foi possível carregar o PTS.';
const SAVE_ERROR = 'Não foi possível registrar o atendimento';

type Form = SoapInput & {
  activityId: string;
  authorId: string;
  appointmentDate: string;
  attendance: Attendance;
  startTime: string;
  endTime: string;
  modality: ActivityModality;
  visitPlace: VisitPlace | '';
  absenceReason: string;
};

type Errors = Partial<Record<keyof Form | 'patient', string>>;

// Na ordem da tela, para o foco ir ao primeiro erro.
const FIELD_IDS: Partial<Record<keyof Errors, string>> = {
  patient: 'appointment-patient',
  activityId: 'appointment-activity',
  appointmentDate: 'appointment-date',
  startTime: 'appointment-start',
  endTime: 'appointment-end',
  visitPlace: 'appointment-place',
  soapSubjective: 'appointment-soapSubjective',
  soapObjective: 'appointment-soapObjective',
  soapAssessment: 'appointment-soapAssessment',
  soapPlan: 'appointment-soapPlan',
};

type Loaded = {
  pts: PtsDetail;
  activities: Activity[];
  goals: Goal[];
};

function validate(form: Form, hasPts: boolean): Errors {
  const errors: Errors = {};
  const done = form.attendance === 'done';

  if (!hasPts) errors.patient = 'Escolha o paciente';
  if (!form.activityId) errors.activityId = 'Escolha a atividade';
  if (!form.appointmentDate) {
    errors.appointmentDate = 'Informe a data do atendimento';
  } else if (
    form.attendance !== 'cancelled' &&
    form.appointmentDate > todayDateOnly()
  ) {
    // Só a desmarcação pode ser avisada antes do dia.
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

function modalityLabel({ modality, visitPlace }: Activity) {
  return visitPlace
    ? `${ACTIVITY_MODALITY_LABELS[modality]} (${VISIT_PLACE_LABELS[visitPlace]})`
    : ACTIVITY_MODALITY_LABELS[modality];
}

// Página "Registrar atendimento" (RFACT004, `registrar-atendimento.html`).
export default function RegisterAppointmentPage({
  account,
  ptsId,
  activityId,
}: {
  account: Account;
  // Vindos do PTS; sem eles, a pessoa escolhe o paciente.
  ptsId?: string;
  activityId?: string;
}) {
  const router = useRouter();
  const isAdmin = account.role === 'admin';
  const [selectedPtsId, setSelectedPtsId] = useState(ptsId ?? '');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [patientsError, setPatientsError] = useState('');
  const { input, setInput, term } = useDebouncedSearch();
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState<Form>({
    activityId: '',
    authorId: '',
    appointmentDate: todayDateOnly(),
    attendance: 'done',
    startTime: '',
    endTime: '',
    modality: 'in_person',
    visitPlace: '',
    soapSubjective: '',
    soapObjective: '',
    soapAssessment: '',
    soapPlan: '',
    absenceReason: '',
  });

  useEffect(() => {
    const controller = new AbortController();

    getPatients({
      page: 1,
      limit: 50,
      q: term,
      status: ['planning', 'running'],
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setPatients(data);
          setPatientsError('');
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setPatientsError('Não foi possível carregar os pacientes');
      });

    return () => controller.abort();
  }, [term, router]);

  useEffect(() => {
    if (!selectedPtsId) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      getPts(selectedPtsId, controller.signal),
      getActivities(
        selectedPtsId,
        { status: ['running'], page: 1, limit: 50 },
        controller.signal,
      ),
      getGoals(selectedPtsId, controller.signal),
    ])
      .then(([pts, activities, goals]) => {
        if (controller.signal.aborted) {
          return;
        }

        const preselected = activities.data.find(
          (activity) => activity.id === activityId,
        );

        setLoaded({ pts, activities: activities.data, goals: goals.data });
        setLoadError('');

        if (preselected) {
          setForm((current) => ({
            ...current,
            activityId: preselected.id,
            modality: preselected.modality,
            visitPlace: preselected.visitPlace ?? '',
          }));
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setLoadError(
          error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : LOAD_ERROR,
        );
      });

    return () => controller.abort();
  }, [selectedPtsId, activityId, reloadKey, router]);

  const current = loaded?.pts.id === selectedPtsId ? loaded : null;
  const members = current ? [current.pts.responsible, ...current.pts.team] : [];
  const activity = current?.activities.find(({ id }) => id === form.activityId);
  const goal = current?.goals.find(({ id }) => id === activity?.goalId);
  const author = members.find(({ id }) =>
    account.professionalProfileIds.includes(id),
  );
  const allowed =
    !current ||
    can(account, 'registerAppointment', {
      pts: {
        status: current.pts.status,
        responsibleProfessionalId: current.pts.responsible.id,
        teamProfessionalIds: current.pts.team.map(({ id }) => id),
      },
      activity: { status: 'running', authorProfessionalId: null },
    });
  const done = form.attendance === 'done';
  const backHref = selectedPtsId
    ? `/pts/${selectedPtsId}#atividades`
    : '/pts/proposals';

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function choosePatient(nextPtsId: string, name: string) {
    setInput(name);
    setSelectedPtsId(nextPtsId);
    setLoadError('');
    setErrors({});
    update('activityId', '');
    update('authorId', '');
  }

  function chooseActivity(id: string) {
    const chosen = current?.activities.find((item) => item.id === id);

    update('activityId', id);

    if (chosen) {
      update('modality', chosen.modality);
      update('visitPlace', chosen.visitPlace ?? '');
    }
  }

  function review() {
    const found = validate(form, Boolean(selectedPtsId));

    setErrors(found);

    const first = (Object.keys(FIELD_IDS) as (keyof Errors)[]).find(
      (key) => found[key],
    );

    if (first) {
      document.getElementById(FIELD_IDS[first]!)?.focus();
      return;
    }

    if (!activity) {
      return;
    }

    setSubmitError('');
    setConfirming(true);
  }

  async function submit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await createAppointment(form.activityId, {
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
        ...(isAdmin &&
          form.authorId && { authorProfessionalId: form.authorId }),
      });

      // A lista de atendimentos é da RFACT006; até lá, volta ao PTS.
      router.push(`/pts/${selectedPtsId}?appointment=registered#atividades`);
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

  const heading = (
    <div className="heading">
      <div>
        <h1>Registrar atendimento</h1>
      </div>
    </div>
  );

  if (loadError || !allowed) {
    return (
      <>
        {heading}
        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível registrar o atendimento</h2>
          <p>
            {loadError ||
              'Só a equipe de um PTS ativo e o administrador registram atendimentos.'}
          </p>
          {loadError ? (
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={() => {
                setLoadError('');
                setReloadKey((key) => key + 1);
              }}
            >
              Tentar novamente
            </button>
          ) : (
            <Link className={`${ui.btn} ${ui.btnSecondary}`} href={backHref}>
              Voltar ao PTS
            </Link>
          )}
        </div>
      </>
    );
  }

  const loading = Boolean(selectedPtsId) && !current;

  return (
    <>
      {heading}

      <form
        className="ux-formcard"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          review();
        }}
      >
        <div className="ux-formcard-head">
          <div>
            <h2>Novo atendimento</h2>
          </div>
        </div>

        <section className="ux-fsection">
          <header>
            <h3>Atividade</h3>
          </header>
          <div>
            <div className="form-grid">
              <FormField
                id="appointment-patient"
                label="Paciente"
                error={errors.patient ?? (patientsError || undefined)}
              >
                <Combobox
                  id="appointment-patient"
                  options={patients
                    .filter((item) => item.activePtsId && !item.readOnly)
                    .map((item) => ({
                      value: item.activePtsId!,
                      label: item.name,
                    }))}
                  input={
                    input || (current && !term ? current.pts.patient.name : '')
                  }
                  onInputChange={(text) => {
                    setInput(text);
                    setSelectedPtsId('');
                    update('activityId', '');
                  }}
                  onSelect={(option) =>
                    choosePatient(option.value, option.label)
                  }
                  placeholder="Busque pelo nome"
                  emptyText="Nenhum paciente com PTS ativo"
                  listLabel="Pacientes"
                  invalid={Boolean(errors.patient)}
                  required
                />
              </FormField>

              <FormField
                id="appointment-activity"
                label="Atividade"
                help="Só atividades em andamento."
                error={errors.activityId}
              >
                <select
                  className="select"
                  id="appointment-activity"
                  aria-required="true"
                  aria-invalid={Boolean(errors.activityId)}
                  disabled={!current}
                  value={form.activityId}
                  onChange={(event) => chooseActivity(event.target.value)}
                >
                  <option value="">
                    {loading
                      ? 'Carregando atividades...'
                      : 'Selecione a atividade'}
                  </option>
                  {current && (
                    <optgroup
                      label={`PTS v${current.pts.version ?? 1}, ${getPtsStatusLabel(
                        current.pts.status,
                      ).toLowerCase()}`}
                    >
                      {current.activities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </FormField>
            </div>

            {current && current.activities.length === 0 && (
              <p role="status">Este PTS não tem atividade em andamento.</p>
            )}

            {activity && (
              <dl className="ux-summary" aria-label="Dados da atividade">
                <div>
                  <dt>Especialidade</dt>
                  <dd>
                    {SPECIALISMS.find(
                      (item) => item.value === activity.specialism,
                    )?.label ?? activity.specialism}
                  </dd>
                </div>
                <div>
                  <dt>Frequência</dt>
                  <dd>{formatFrequency(activity.frequency)}</dd>
                </div>
                <div>
                  <dt>Modalidade da atividade</dt>
                  <dd>{modalityLabel(activity)}</dd>
                </div>
                <div>
                  <dt>Meta ligada</dt>
                  <dd>{goal?.title ?? 'Sem meta associada'}</dd>
                </div>
              </dl>
            )}
          </div>
        </section>

        <section className="ux-fsection">
          <header>
            <h3>Autoria</h3>
          </header>
          <div>
            <div className="form-grid">
              {isAdmin ? (
                <FormField
                  id="appointment-author"
                  label="Autor"
                  help="Profissional da equipe do PTS."
                  required={false}
                >
                  <select
                    className="select"
                    id="appointment-author"
                    value={form.authorId}
                    onChange={(event) => update('authorId', event.target.value)}
                  >
                    <option value="">
                      Sem atribuir (fica com a sua conta)
                    </option>
                    {members.map((item) => (
                      <option key={item.id} value={item.id}>
                        {`${item.name}, ${item.specialism.name}`}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : (
                <FormField
                  id="appointment-author"
                  label="Autor"
                  required={false}
                >
                  <input
                    className="input"
                    id="appointment-author"
                    type="text"
                    readOnly
                    value={
                      author
                        ? `${author.name}, ${author.specialism.name}`
                        : account.name
                    }
                  />
                </FormField>
              )}
              <FormField
                id="appointment-registered-by"
                label="Registrado por"
                required={false}
              >
                <input
                  className="input"
                  id="appointment-registered-by"
                  type="text"
                  readOnly
                  value={`${account.name} (você)`}
                />
              </FormField>
            </div>
          </div>
        </section>

        <section className="ux-fsection">
          <header>
            <h3>Sessão</h3>
          </header>
          <div>
            <div className="form-grid">
              <FormField
                id="appointment-date"
                label="Data do atendimento"
                error={errors.appointmentDate}
              >
                <input
                  className="input"
                  id="appointment-date"
                  type="date"
                  aria-required="true"
                  aria-invalid={Boolean(errors.appointmentDate)}
                  value={form.appointmentDate}
                  onChange={(event) =>
                    update('appointmentDate', event.target.value)
                  }
                />
              </FormField>

              <FormField id="appointment-attendance" label="Comparecimento">
                <select
                  className="select"
                  id="appointment-attendance"
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
                id="appointment-start"
                label="Hora de início"
                error={errors.startTime}
              >
                <input
                  className="input"
                  id="appointment-start"
                  type="time"
                  aria-required="true"
                  aria-invalid={Boolean(errors.startTime)}
                  value={form.startTime}
                  onChange={(event) => update('startTime', event.target.value)}
                />
              </FormField>

              {done && (
                <FormField
                  id="appointment-end"
                  label="Hora de término"
                  help="Obrigatória no atendimento realizado."
                  error={errors.endTime}
                >
                  <input
                    className="input"
                    id="appointment-end"
                    type="time"
                    aria-required="true"
                    aria-invalid={Boolean(errors.endTime)}
                    value={form.endTime}
                    onChange={(event) => update('endTime', event.target.value)}
                  />
                </FormField>
              )}

              <FormField id="appointment-modality" label="Modalidade">
                <select
                  className="select"
                  id="appointment-modality"
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
                  id="appointment-place"
                  label="Local da visita"
                  help="Obrigatório na visita externa."
                  error={errors.visitPlace}
                >
                  <select
                    className="select"
                    id="appointment-place"
                    aria-required="true"
                    aria-invalid={Boolean(errors.visitPlace)}
                    value={form.visitPlace}
                    onChange={(event) =>
                      update('visitPlace', event.target.value as VisitPlace)
                    }
                  >
                    <option value="">Selecione o local</option>
                    {Object.entries(VISIT_PLACE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </FormField>
              )}
            </div>
          </div>
        </section>

        {done ? (
          <SoapFields values={form} errors={errors} onChange={update} />
        ) : (
          <section className="ux-fsection">
            <header>
              <h3>Motivo</h3>
            </header>
            <div>
              <div className="form-grid">
                <FormField
                  id="appointment-reason"
                  label="Motivo da falta ou da desmarcação"
                  required={false}
                  full
                >
                  <textarea
                    className="input"
                    id="appointment-reason"
                    rows={3}
                    value={form.absenceReason}
                    onChange={(event) =>
                      update('absenceReason', event.target.value)
                    }
                  />
                </FormField>
              </div>
            </div>
          </section>
        )}

        <div className="ux-formcard-foot">
          <Link className="btn" href={backHref}>
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Icon name="check" className="icon-sm" />
            Registrar atendimento
          </button>
        </div>
      </form>

      {confirming && (
        <Modal
          open
          id="appointment-confirm"
          size="sm"
          title="Registrar o atendimento?"
          description="Depois de salvo, o registro não é editado: correções viram retificação."
          busy={submitting}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                aria-busy={submitting}
                onClick={submit}
              >
                {submitting ? 'Registrando...' : 'Registrar atendimento'}
              </button>
            </>
          }
        >
          {submitError && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              <p>{submitError}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
