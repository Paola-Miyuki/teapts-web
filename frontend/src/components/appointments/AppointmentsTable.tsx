'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import patientStyles from '@/app/patients/patients.module.css';
import {
  ACTIVITY_MODALITY_LABELS,
  type ActivityModality,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import {
  appointmentModalityLabel,
  ATTENDANCE_LABELS,
  getAppointments,
  specialismLabel,
  type AppointmentList,
  type AppointmentListItem,
  type AppointmentsQuery,
  type Attendance,
} from '@/lib/appointments';
import { formatDateOnly } from '@/lib/format';
import { can, type PermissionUser } from '@/lib/permissions';
import { SPECIALISMS } from '@/lib/professionals';
import AppointmentViewDialog from './AppointmentViewDialog';

type AppointmentsTableProps = {
  // Prefixo dos ids da tabela (cada instância na página tem o seu).
  id: string;
  title: string;
  account: PermissionUser;
  // Filtro fixo da aba: o paciente do prontuário ou o PTS.
  scope?: Pick<AppointmentsQuery, 'patientId' | 'ptsId' | 'activityId'>;
  // A página da equipe mostra a coluna Paciente; as abas, não.
  showPatient?: boolean;
  // Link "Registrar atendimento" do cabeçalho.
  action?: ReactNode;
};

const ATTENDANCE_OPTIONS = Object.entries(ATTENDANCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const MODALITY_OPTIONS = Object.entries(ACTIVITY_MODALITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const SPECIALISM_OPTIONS = SPECIALISMS.map(({ value, label }) => ({
  value,
  label,
}));

// `AAAA-MM-DD` de N dias atrás, para o filtro de período.
function daysAgo(days: number) {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date.toISOString().slice(0, 10);
}

function Professional({ author }: { author: AppointmentListItem['author'] }) {
  if (!author) {
    return (
      <span className="empty-cell" aria-label="Não informado">
        —
      </span>
    );
  }

  return (
    <div className="stacked">
      {author.name}
      <small>{specialismLabel(author.specialism)}</small>
    </div>
  );
}

// Tabela de `atendimentos.html`, `meus-atendimentos.html` e das abas
// Atendimentos do prontuário e do PTS (RFACT006): filtros, paginação e o
// modal; "Retificar" só para o autor (RFACT007).
export default function AppointmentsTable({
  id,
  title,
  account,
  scope,
  showPatient = false,
  action,
}: AppointmentsTableProps) {
  const router = useRouter();
  const patientView = !can(account, 'viewAppointments');
  const [attendance, setAttendance] = useState<string[]>([]);
  const [modality, setModality] = useState<string[]>([]);
  const [specialism, setSpecialism] = useState<string[]>([]);
  const [period, setPeriod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PER_PAGE_OPTIONS[0]);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<AppointmentList | null>(null);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<{
    id: string;
    rectify: boolean;
  } | null>(null);
  const [success, setSuccess] = useState('');

  const { patientId, ptsId, activityId } = scope ?? {};
  const periodFrom =
    period === '30' || period === '90'
      ? daysAgo(Number(period))
      : period === 'custom'
        ? from
        : '';
  const periodTo = period === 'custom' ? to : '';
  const filterKey = [
    attendance.join(','),
    modality.join(','),
    specialism.join(','),
    periodFrom,
    periodTo,
  ].join('\n');

  useEffect(() => {
    const controller = new AbortController();
    const [attendanceKey, modalityKey, specialismKey, fromKey, toKey] =
      filterKey.split('\n');
    const list = (value?: string) => (value ? value.split(',') : undefined);

    getAppointments(
      {
        page,
        limit,
        patientId,
        ptsId,
        activityId,
        attendance: list(attendanceKey) as Attendance[] | undefined,
        modality: list(modalityKey) as ActivityModality[] | undefined,
        specialism: list(specialismKey),
        from: fromKey || undefined,
        to: toKey || undefined,
      },
      controller.signal,
    )
      .then((response) => {
        setError('');
        setResult(response);
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
            : 'Verifique sua conexão e tente novamente.',
        );
      });

    return () => controller.abort();
  }, [activityId, filterKey, limit, page, patientId, ptsId, retryKey, router]);

  const hasFilters =
    attendance.length > 0 ||
    modality.length > 0 ||
    specialism.length > 0 ||
    period !== '';
  const total = result?.pagination.total ?? 0;
  const count = result
    ? `${total} ${total === 1 ? 'atendimento' : 'atendimentos'}${hasFilters ? ' com os filtros atuais' : ''}`
    : 'Carregando...';
  const columns = showPatient ? 7 : 6;

  function filter(change: () => void) {
    change();
    setPage(1);
  }

  function clearFilters() {
    filter(() => {
      setAttendance([]);
      setModality([]);
      setSpecialism([]);
      setPeriod('');
      setFrom('');
      setTo('');
    });
  }

  function canRectify(appointment: { author: { id: string } | null }) {
    return can(account, 'rectifyAppointment', { appointment });
  }

  return (
    <div className="ux-tcard">
      <div className="ux-tcard-head">
        <div>
          <h2>{title}</h2>
          <p className="count" aria-live="polite">
            {count}
          </p>
        </div>

        {action}
      </div>

      <div className="ux-toolbar">
        <div className="ux-tools">
          <button
            type="button"
            className="btn filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls={`${id}-more`}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Icon name="filter" className="icon-sm" />
            Filtros
          </button>

          {hasFilters && (
            <button type="button" className="btn" onClick={clearFilters}>
              <Icon name="close" className="icon-sm" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="filter-more" id={`${id}-more`} hidden={!filtersOpen}>
        {!patientView && (
          <MultiSelect
            label="Especialidade"
            placeholder="Todas as especialidades"
            options={SPECIALISM_OPTIONS}
            value={specialism}
            onChange={(value) => filter(() => setSpecialism(value))}
          />
        )}

        <MultiSelect
          label="Comparecimento"
          placeholder="Todos"
          options={ATTENDANCE_OPTIONS}
          value={attendance}
          onChange={(value) => filter(() => setAttendance(value))}
        />

        <MultiSelect
          label="Modalidade"
          placeholder="Todas"
          options={MODALITY_OPTIONS}
          value={modality}
          onChange={(value) => filter(() => setModality(value))}
        />

        <div className="field">
          <label className="field-label" htmlFor={`${id}-period`}>
            Período
          </label>
          <select
            className="select"
            id={`${id}-period`}
            value={period}
            onChange={(event) =>
              filter(() => {
                setPeriod(event.target.value);
                setFrom('');
                setTo('');
              })
            }
          >
            <option value="">Qualquer período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Personalizado</option>
          </select>

          {period === 'custom' && (
            <div className="range-custom">
              <input
                className="input"
                type="date"
                aria-label="De"
                value={from}
                onChange={(event) => filter(() => setFrom(event.target.value))}
              />
              <input
                className="input"
                type="date"
                aria-label="Até"
                value={to}
                onChange={(event) => filter(() => setTo(event.target.value))}
              />
            </div>
          )}
        </div>
      </div>

      {success && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{success}</span>
        </div>
      )}

      {error ? (
        <div className={ui.empty} role="alert">
          <h2>Não foi possível carregar os atendimentos</h2>
          <p>{error}</p>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : !result ? (
        <div className={ui.empty} role="status" aria-live="polite">
          <div className={patientStyles.loader} />
          <p>Carregando atendimentos...</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table" id={id}>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  {showPatient && <th scope="col">Paciente</th>}
                  <th scope="col">Atividade</th>
                  <th scope="col">Profissional</th>
                  <th scope="col">Modalidade</th>
                  <th scope="col">Comparecimento</th>
                  <th scope="col" className="actions-col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.length === 0 ? (
                  <tr>
                    <td colSpan={columns}>
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon
                            name={hasFilters ? 'search' : 'session'}
                            className="icon"
                          />
                        </div>
                        <h2>
                          {hasFilters
                            ? 'Nenhum atendimento encontrado'
                            : 'Nenhum atendimento registrado'}
                        </h2>
                        <p>
                          {hasFilters
                            ? 'Revise ou limpe os filtros.'
                            : 'Os atendimentos registrados aparecem aqui.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  result.data.map((appointment) => {
                    const date = formatDateOnly(appointment.appointmentDate);

                    return (
                      <tr key={appointment.id}>
                        <td className="num">
                          {date}
                          {appointment.rectified && (
                            <>
                              {' '}
                              <span className="badge">Retificado</span>
                            </>
                          )}
                        </td>
                        {showPatient && (
                          <td>
                            <div className="person">
                              <span className="avatar" aria-hidden="true">
                                {appointment.patient.name.charAt(0)}
                              </span>
                              <div>
                                <Link
                                  className="link"
                                  href={`/patients/${appointment.patient.id}`}
                                >
                                  {appointment.patient.name}
                                </Link>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="ux-wide">
                          {appointment.activity.title}
                        </td>
                        <td>
                          <Professional author={appointment.author} />
                        </td>
                        <td>{appointmentModalityLabel(appointment)}</td>
                        <td>
                          <span className={`badge ${appointment.attendance}`}>
                            {ATTENDANCE_LABELS[appointment.attendance]}
                          </span>
                        </td>
                        <td className="actions-col">
                          <KebabMenu
                            label={`Ações para Atendimento de ${date}`}
                          >
                            <li>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setSuccess('');
                                  setOpened({
                                    id: appointment.id,
                                    rectify: false,
                                  });
                                }}
                              >
                                <Icon name="eye" className="icon-sm" />
                                Visualizar
                              </button>
                            </li>
                            {canRectify(appointment) && (
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setSuccess('');
                                    setOpened({
                                      id: appointment.id,
                                      rectify: true,
                                    });
                                  }}
                                >
                                  <Icon name="edit" className="icon-sm" />
                                  Retificar
                                </button>
                              </li>
                            )}
                          </KebabMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            label="Paginação de atendimentos"
            page={result.pagination.page}
            limit={limit}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        </>
      )}

      {opened && (
        <AppointmentViewDialog
          appointmentId={opened.id}
          startRectifying={opened.rectify}
          canRectify={canRectify}
          onRectified={() => {
            setSuccess('Retificação registrada');
            setRetryKey((current) => current + 1);
          }}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
