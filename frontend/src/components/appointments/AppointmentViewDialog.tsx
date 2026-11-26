'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  appointmentModalityLabel,
  ATTENDANCE_LABELS,
  getAppointment,
  specialismLabel,
  type AppointmentDetails,
  type AppointmentRecord,
} from '@/lib/appointments';
import { formatDateOnly, formatDateTime } from '@/lib/format';
import type { AppointmentPermissionData } from '@/lib/permissions';
import RectifyAppointmentForm from './RectifyAppointmentForm';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

type AppointmentViewDialogProps = {
  appointmentId: string;
  // Abre direto no formulário (ação "Retificar" da linha).
  startRectifying?: boolean;
  canRectify: (appointment: AppointmentPermissionData) => boolean;
  onRectified: () => void;
  onClose: () => void;
};

function authorLabel(author: AppointmentRecord['author']) {
  return author
    ? `${author.name}, ${specialismLabel(author.specialism)}`
    : 'Não atribuído';
}

function timeRange({ startTime, endTime }: AppointmentRecord) {
  return endTime ? `${startTime} às ${endTime}` : startTime;
}

function AttendanceBadge({ record }: { record: AppointmentRecord }) {
  return (
    <span className={`badge ${record.attendance}`}>
      {ATTENDANCE_LABELS[record.attendance]}
    </span>
  );
}

// SOAP da equipe; o paciente vê só o plano (RN028).
function Evolution({ record }: { record: AppointmentRecord }) {
  if (record.soap) {
    return (
      <dl className="soap">
        <div className="soap-item">
          <dt>S, Subjetivo</dt>
          <dd>{record.soap.subjective}</dd>
        </div>
        <div className="soap-item">
          <dt>O, Objetivo</dt>
          <dd>{record.soap.objective}</dd>
        </div>
        <div className="soap-item">
          <dt>A, Avaliação</dt>
          <dd>{record.soap.assessment}</dd>
        </div>
        <div className="soap-item">
          <dt>P, Plano</dt>
          <dd>{record.soap.plan}</dd>
        </div>
      </dl>
    );
  }

  if (record.plan) {
    return (
      <dl className="soap">
        <div className="soap-item">
          <dt>P, Plano</dt>
          <dd>{record.plan}</dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="data-grid">
      <div className="full">
        <dt>Motivo</dt>
        <dd>{record.absenceReason ?? 'Não informado'}</dd>
      </div>
    </dl>
  );
}

function Signature({ record }: { record: AppointmentRecord }) {
  return (
    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
      Assinado por {record.author?.name ?? record.registeredBy.name} em{' '}
      {formatDateTime(record.createdAt)}.
    </p>
  );
}

// Modal "Atendimento de dd/mm/aaaa" de `atendimentos.html` (RFACT006), com o
// bloco de cada retificação e a ação "Retificar" do autor (RFACT007).
export default function AppointmentViewDialog({
  appointmentId,
  startRectifying = false,
  canRectify,
  onRectified,
  onClose,
}: AppointmentViewDialogProps) {
  const router = useRouter();
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null,
  );
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [rectifying, setRectifying] = useState(startRectifying);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    getAppointment(appointmentId, controller.signal)
      .then((response) => {
        setError('');
        setAppointment(response);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : LOAD_ERROR,
        );
      });

    return () => controller.abort();
  }, [appointmentId, reloadKey, router]);

  // A equipe recebe o SOAP (ou null na falta); o paciente, o plano.
  const team = appointment ? 'soap' in appointment : false;
  const allowed = appointment ? canRectify(appointment) : false;

  if (appointment && rectifying && allowed) {
    return (
      <RectifyAppointmentForm
        appointment={appointment}
        onCancel={() => (startRectifying ? onClose() : setRectifying(false))}
        onRectified={() => {
          onRectified();
          setSuccess('Retificação registrada');
          setRectifying(false);
          setAppointment(null);
          setReloadKey((current) => current + 1);
        }}
      />
    );
  }

  const date = appointment ? formatDateOnly(appointment.appointmentDate) : '';

  return (
    <Modal
      open
      id="appointment-view"
      title={appointment ? `Atendimento de ${date}` : 'Atendimento'}
      description={
        appointment?.rectified
          ? 'Retificado: o registro original continua guardado.'
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
          {appointment && allowed && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSuccess('');
                setRectifying(true);
              }}
            >
              <Icon name="edit" className="icon-sm" />
              Retificar
            </button>
          )}
        </>
      }
    >
      {success && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{success}</span>
        </div>
      )}

      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setError('');
              setReloadKey((current) => current + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : !appointment ? (
        <p role="status" aria-live="polite">
          Carregando atendimento...
        </p>
      ) : team ? (
        <>
          <section>
            <dl className="data-grid">
              <div>
                <dt>Paciente</dt>
                <dd>{appointment.patient.name}</dd>
              </div>
              <div>
                <dt>PTS</dt>
                <dd>PTS v{appointment.pts.version}</dd>
              </div>
              <div>
                <dt>Atividade</dt>
                <dd>{appointment.activity.title}</dd>
              </div>
              <div>
                <dt>Especialidade</dt>
                <dd>{specialismLabel(appointment.activity.specialism)}</dd>
              </div>
              <div>
                <dt>Autor</dt>
                <dd>{authorLabel(appointment.author)}</dd>
              </div>
              <div>
                <dt>Registrado por</dt>
                <dd>{appointment.registeredBy.name}</dd>
              </div>
              <div>
                <dt>Data do atendimento</dt>
                <dd>{date}</dd>
              </div>
              <div>
                <dt>Hora de início</dt>
                <dd>{appointment.startTime}</dd>
              </div>
              <div>
                <dt>Hora de término</dt>
                <dd>{appointment.endTime ?? '—'}</dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>{appointmentModalityLabel(appointment)}</dd>
              </div>
              <div>
                <dt>Comparecimento</dt>
                <dd>
                  <AttendanceBadge record={appointment} />
                </dd>
              </div>
              <div>
                <dt>Criado em</dt>
                <dd>{formatDateTime(appointment.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>
              {appointment.attendance === 'done'
                ? 'Evolução (SOAP)'
                : 'Motivo da falta ou da desmarcação'}
            </h3>
            <Evolution record={appointment} />
          </section>

          {appointment.rectifications.map((rectification) => (
            <section key={rectification.id}>
              <h3>Retificação</h3>
              <dl className="data-grid">
                <div>
                  <dt>Retifica</dt>
                  <dd>
                    Registro de {formatDateTime(appointment.createdAt)} (o
                    original continua guardado)
                  </dd>
                </div>
                <div>
                  <dt>Registrado por</dt>
                  <dd>{rectification.registeredBy.name}</dd>
                </div>
                <div>
                  <dt>Retificado em</dt>
                  <dd>{formatDateTime(rectification.createdAt)}</dd>
                </div>
                <div className="full">
                  <dt>Justificativa da retificação</dt>
                  <dd>{rectification.rectificationReason}</dd>
                </div>
                <div>
                  <dt>Data do atendimento</dt>
                  <dd>{formatDateOnly(rectification.appointmentDate)}</dd>
                </div>
                <div>
                  <dt>Horário</dt>
                  <dd>{timeRange(rectification)}</dd>
                </div>
                <div>
                  <dt>Modalidade</dt>
                  <dd>{appointmentModalityLabel(rectification)}</dd>
                </div>
                <div>
                  <dt>Comparecimento</dt>
                  <dd>
                    <AttendanceBadge record={rectification} />
                  </dd>
                </div>
              </dl>
              <Evolution record={rectification} />
            </section>
          ))}
        </>
      ) : (
        <>
          <section>
            <dl className="data-grid">
              <div>
                <dt>Data</dt>
                <dd>
                  {date}, {timeRange(appointment)}
                </dd>
              </div>
              <div>
                <dt>Atividade</dt>
                <dd>{appointment.activity.title}</dd>
              </div>
              <div>
                <dt>Profissional</dt>
                <dd>{authorLabel(appointment.author)}</dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>{appointmentModalityLabel(appointment)}</dd>
              </div>
              <div>
                <dt>Comparecimento</dt>
                <dd>
                  <AttendanceBadge record={appointment} />
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>
              {appointment.attendance === 'done'
                ? 'Plano e orientações'
                : 'Motivo da falta ou da desmarcação'}
            </h3>
            <Evolution record={appointment} />
          </section>
          <Signature record={appointment} />

          {appointment.rectifications.map((rectification) => (
            <section key={rectification.id}>
              <h3>Retificação de {formatDateTime(rectification.createdAt)}</h3>
              <dl className="data-grid">
                <div>
                  <dt>Data</dt>
                  <dd>
                    {formatDateOnly(rectification.appointmentDate)},{' '}
                    {timeRange(rectification)}
                  </dd>
                </div>
                <div>
                  <dt>Comparecimento</dt>
                  <dd>
                    <AttendanceBadge record={rectification} />
                  </dd>
                </div>
              </dl>
              <Evolution record={rectification} />
              <Signature record={rectification} />
            </section>
          ))}
        </>
      )}
    </Modal>
  );
}
