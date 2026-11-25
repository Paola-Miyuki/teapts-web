'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import RegistrationCell from '@/components/table/RegistrationCell';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDate, formatDateOnly } from '@/lib/format';
import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';
import { formatRegistration } from '@/lib/professionals';
import {
  getPts,
  type ClosePtsResponse,
  type PtsDetail,
  type PtsProfessional,
  type PtsStartResponse,
} from '@/lib/pts';
import GoalsTab from '@/components/pts/GoalsTab';
import ActivitiesTab from '@/components/pts/ActivitiesTab';
import { useActivities } from '@/hooks/useActivities';
import { type ActivityExecutor, type ActivityStatus } from '@/lib/activities';
import { useGoals } from '@/hooks/useGoals';
import TimelineTab from '@/components/pts/TimelineTab';
import PtsSheetCards from '../_components/PtsSheetCards';
import {
  AddTeamMembersModal,
  type PtsData,
} from '../_components/AddTeamMembersModal';
import ClosePtsDialog from '../_components/ClosePtsDialog';
import StartPtsDialog from '../_components/StartPtsDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente';
const DEFAULT_ACTIVITY_STATUSES: ActivityStatus[] = [
  'suggested',
  'running',
  'suspended',
];
const ALL_ACTIVITY_STATUSES: ActivityStatus[] = [
  ...DEFAULT_ACTIVITY_STATUSES,
  'concluded',
  'rejected',
  'archived',
];

type Tab = 'visao' | 'metas' | 'equipe' | 'atividades' | 'timeline';

// Como nos mockups, a aba ativa é o #hash da URL (`#timeline` é o atalho de historico.html).
function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash.slice(1);
}

function useHashTab(tabs: Tab[]) {
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    const sync = () => setHash(currentHash());

    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function open(tab: Tab) {
    const { pathname, search } = window.location;

    window.history.pushState(
      window.history.state,
      '',
      `${pathname}${search}#${tab}`,
    );
    setHash(tab);
  }

  return [tabs.includes(hash as Tab) ? (hash as Tab) : tabs[0], open] as const;
}

function EmptyCell() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <EmptyCell />}</dd>
    </div>
  );
}

function professionalLabel(professional: PtsProfessional) {
  return `${professional.name}, ${professional.specialism.name}`;
}

// Detalhe do PTS: `pts-detalhe.html` para a equipe e o admin, `pts.html` para o paciente.
// Atendimentos e as ações do PTS entram com as tasks deles.
export default function PtsDetailPage({
  id,
  readOnly = false,
  version,
}: {
  id: string;
  readOnly?: boolean;
  version?: number;
}) {
  const [patientName, setPatientName] = useState('');

  return (
    <AuthenticatedPage
      currentHref={(kind) => (kind === 'patient' ? '/pts' : '/pts/proposals')}
      breadcrumb={(kind) =>
        kind === 'patient'
          ? [
              { label: 'Meu PTS', href: '/pts' },
              {
                label: version
                  ? `${version}º PTS`
                  : patientName || 'Detalhe do PTS',
              },
            ]
          : [
              { label: 'PTS', href: '/pts/proposals' },
              { label: patientName || 'Detalhe do PTS' },
            ]
      }
      requiredAction="viewPts"
    >
      {(account, kind) => (
        <PtsDetailContent
          id={id}
          onLoaded={setPatientName}
          isPatient={kind === 'patient'}
          account={account}
          readOnly={readOnly}
          version={version}
        />
      )}
    </AuthenticatedPage>
  );
}

function PtsDetailContent({
  id,
  onLoaded,
  isPatient,
  account,
  readOnly,
  version,
}: {
  id: string;
  onLoaded: (patientName: string) => void;
  isPatient: boolean;
  account: Account;
  readOnly: boolean;
  version?: number;
}) {
  const router = useRouter();
  const canOpenRecord = can(account, 'viewAuthorizedPatients');
  const currentUserProfileIds = account.professionalProfileIds ?? [];
  const isAdmin = account.role === 'admin';
  const [pts, setPts] = useState<PtsDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [activityStatuses, setActivityStatuses] = useState<
    ActivityStatus[] | undefined
  >();
  const [activityExecutor, setActivityExecutor] = useState<
    ActivityExecutor | undefined
  >();
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit, setActivityLimit] = useState(10);
  // O paciente não vê a ficha (RN028), então não tem a Visão geral.
  const [tab, setTab] = useHashTab(
    isPatient
      ? ['metas', 'equipe', 'atividades', 'timeline']
      : ['visao', 'metas', 'equipe', 'atividades', 'timeline'],
  );

  const { goals, error: goalsError, reload: reloadGoals } = useGoals(id);
  const activityStatusFilter =
    activityStatuses ??
    (['concluded', 'cancelled'].includes(pts?.status ?? '')
      ? undefined
      : DEFAULT_ACTIVITY_STATUSES);
  const {
    activities,
    pagination: activitiesPagination,
    error: activitiesError,
    reload: reloadActivities,
  } = useActivities(id, {
    status: activityStatusFilter,
    executor: activityExecutor,
    page: activityPage,
    limit: activityLimit,
  });

  useEffect(() => {
    const controller = new AbortController();

    getPts(id, controller.signal)
      .then((response) => {
        setError(null);
        setPts(response);
        onLoaded(response.patient.name);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(reason);
      });

    return () => controller.abort();
  }, [id, onLoaded, retryKey, router]);

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    const title =
      status === 404
        ? 'PTS não encontrado'
        : status === 403
          ? 'Sem acesso a este PTS'
          : 'Não foi possível carregar o PTS';

    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>
        <h2>{title}</h2>
        <p>
          {error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : LOAD_ERROR}
        </p>
        {status === 403 || status === 404 ? (
          canOpenRecord ? (
            <Link href="/patients" className={`${ui.btn} ${ui.btnSecondary}`}>
              Voltar para pacientes
            </Link>
          ) : (
            <Link href="/home" className={`${ui.btn} ${ui.btnSecondary}`}>
              Voltar para o início
            </Link>
          )
        ) : (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (!pts) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <p>Carregando PTS...</p>
      </div>
    );
  }

  const members = [pts.responsible, ...pts.team];
  // RFEM001 – só o responsável ou o admin, e só com o PTS em planejamento ou
  // andamento (a API responde 409 PTS_NOT_ACTIVE fora disso).
  const canManageTeam =
    !readOnly &&
    (isAdmin || currentUserProfileIds.includes(pts.responsible.id)) &&
    ['planning', 'running'].includes(pts.status);

  // RFPTS005 – equipe ou admin, com o PTS ativo; o paciente não edita.
  const canEditPts =
    !readOnly &&
    !isPatient &&
    (isAdmin ||
      members.some((member) => currentUserProfileIds.includes(member.id))) &&
    ['planning', 'running'].includes(pts.status);

  const permissionPts = {
    status: pts.status,
    responsibleProfessionalId: pts.responsible.id,
    teamProfessionalIds: pts.team.map((member) => member.id),
  };
  const canStart =
    !readOnly && can(account, 'startPts', { pts: permissionPts });
  const canClose =
    !readOnly && can(account, 'closePts', { pts: permissionPts });
  const canReassess =
    !readOnly &&
    can(account, 'registerPtsReassessment', {
      pts: permissionPts,
    });

  // PTS encerrado antes da RFPTS010 só tem a data do registro.
  const closedAt = pts.concludedAt ?? pts.cancelledAt;
  const closedOn = pts.closingDate
    ? formatDateOnly(pts.closingDate)
    : closedAt && formatDate(closedAt);
  const canManageGoals =
    !readOnly &&
    !isPatient &&
    can(account, 'manageGoals', { pts: permissionPts });

  const canCreateActivity =
    !readOnly &&
    !isPatient &&
    can(account, 'createActivity', { pts: permissionPts });

  const handleStarted = ({ status, beganAt }: PtsStartResponse) => {
    setPts((prev) => (prev ? { ...prev, status, beganAt } : prev));
    setIsStartOpen(false);
  };

  const handleClosed = (closed: ClosePtsResponse) => {
    setPts((prev) =>
      prev
        ? {
            ...prev,
            status: closed.status,
            closingDate: closed.closingDate,
            closingReason: closed.closingReason,
          }
        : prev,
    );
    setIsCloseOpen(false);
    // As atividades em andamento ou suspensas são encerradas junto.
    reloadActivities();
  };

  const handleTeamUpdated = (updatedPts: PtsData) => {
    setPts((prev) =>
      prev
        ? {
            ...prev,
            team: updatedPts.team as PtsProfessional[],
          }
        : prev,
    );
  };

  return (
    <>
      <section className="ux-card ux-ptshead" aria-labelledby="pts-title">
        <div className="ux-ptshead-main">
          <span className="ux-ptsicon" aria-hidden="true">
            <Icon name="pts" />
          </span>
          <div>
            <h1 id="pts-title">
              {version ? `${version}º PTS` : `PTS de ${pts.patient.name}`}
            </h1>
            <div className="ux-badges">
              <PtsStatusBadge status={pts.status} />
            </div>
          </div>
        </div>

        <dl className="ux-dl">
          <Item label="Responsável">{professionalLabel(pts.responsible)}</Item>
          <Item label="Criado em">{formatDate(pts.createdAt)}</Item>
          {pts.acceptedAt && (
            <Item label="Aceito em">{formatDate(pts.acceptedAt)}</Item>
          )}
          <Item label="Início">{pts.beganAt && formatDate(pts.beganAt)}</Item>
          {closedOn && <Item label="Encerrado em">{closedOn}</Item>}
          {pts.closingReason && (
            <Item label="Motivo do encerramento">{pts.closingReason}</Item>
          )}
          {pts.rejectedAt && (
            <Item label="Rejeitado em">{formatDate(pts.rejectedAt)}</Item>
          )}
        </dl>

        {(canOpenRecord || canEditPts) && (
          <div className="heading-actions">
            {canOpenRecord && (
              <Link className="btn" href={`/patients/${pts.patient.id}`}>
                <Icon name="patient" className="icon-sm" />
                Prontuário
              </Link>
            )}
            {canEditPts && (
              <Link className="btn" href={`/pts/${pts.id}/edit`}>
                <Icon name="edit" className="icon-sm" />
                Editar PTS
              </Link>
            )}
            {canStart && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsStartOpen(true)}
              >
                <Icon name="check" className="icon-sm" />
                Iniciar execução
              </button>
            )}
            {/* Desabilitado até existir a tela de reavaliação (RFEVA005). */}
            {canReassess && (
              <button type="button" className="btn btn-primary" disabled>
                <Icon name="checkCircle" className="icon-sm" />
                Registrar reavaliação
              </button>
            )}
            {canClose && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setIsCloseOpen(true)}
              >
                <Icon name="lock" className="icon-sm" />
                Encerrar
              </button>
            )}
          </div>
        )}
      </section>

      {canClose && isCloseOpen && (
        <ClosePtsDialog
          ptsId={pts.id}
          patientName={pts.patient.name}
          onClosed={handleClosed}
          onClose={() => setIsCloseOpen(false)}
        />
      )}

      {canStart && (
        <StartPtsDialog
          open={isStartOpen}
          ptsId={pts.id}
          patientName={pts.patient.name}
          onClose={() => setIsStartOpen(false)}
          onStarted={handleStarted}
        />
      )}

      <nav className="tabs ux-ptabs" aria-label="Seções do PTS">
        {!isPatient && (
          <a
            href="#visao"
            aria-current={tab === 'visao' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setTab('visao');
            }}
          >
            Visão geral
          </a>
        )}
        <a
          href="#metas"
          aria-current={tab === 'metas' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setTab('metas');
          }}
        >
          Metas terapêuticas
          {goals && <span className="tab-count">{goals.length}</span>}
        </a>
        <a
          href="#equipe"
          aria-current={tab === 'equipe' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setTab('equipe');
          }}
        >
          Equipe
          <span className="tab-count">{members.length}</span>
        </a>
        <a
          href="#atividades"
          aria-current={tab === 'atividades' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setTab('atividades');
          }}
        >
          Atividades
          {activitiesPagination && (
            <span className="tab-count">{activitiesPagination.total}</span>
          )}
        </a>
        <a
          href="#timeline"
          aria-current={tab === 'timeline' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setTab('timeline');
          }}
        >
          Timeline
        </a>
      </nav>

      {tab === 'timeline' ? (
        <section data-panel="timeline" id="timeline">
          {/* A key recarrega os eventos quando o status muda (pts_started). */}
          <TimelineTab
            key={pts.status}
            ptsId={pts.id}
            patientId={pts.patient.id}
            team={members.map(({ id: memberId, name }) => ({
              id: memberId,
              name,
            }))}
            isPatient={isPatient}
          />
        </section>
      ) : tab === 'atividades' ? (
        <section data-panel="atividades" id="atividades">
          <ActivitiesTab
            ptsId={pts.id}
            activities={activities}
            pagination={activitiesPagination}
            error={activitiesError}
            reload={() => {
              reloadActivities();
              // A quantidade de atividades de cada meta muda.
              reloadGoals();
            }}
            canCreate={canCreateActivity}
            canEdit={(activity) =>
              !readOnly &&
              !isPatient &&
              can(account, 'editActivity', { pts: permissionPts, activity })
            }
            canArchive={(activity) =>
              !readOnly &&
              !isPatient &&
              can(account, 'archiveActivity', { pts: permissionPts, activity })
            }
            team={members.map((member) => ({
              id: member.id,
              name: member.name,
              specialism: member.specialism.name,
            }))}
            goals={goals ?? []}
            isAdmin={isAdmin}
            statusFilter={activityStatusFilter}
            onStatusFilterChange={(status) => {
              setActivityStatuses(status ?? ALL_ACTIVITY_STATUSES);
              setActivityPage(1);
            }}
            executorFilter={activityExecutor}
            onExecutorFilterChange={(executor) => {
              setActivityExecutor(executor);
              setActivityPage(1);
            }}
            page={activityPage}
            limit={activityLimit}
            onPageChange={setActivityPage}
            onLimitChange={(limit) => {
              setActivityLimit(limit);
              setActivityPage(1);
            }}
          />
        </section>
      ) : tab === 'metas' ? (
        <section data-panel="metas" id="metas">
          <GoalsTab
            ptsId={pts.id}
            goals={goals}
            error={goalsError}
            reload={reloadGoals}
            nextReviewAt={pts.nextReviewAt}
            previousVersion={pts.previousPts?.version}
            canManage={canManageGoals}
            authors={
              isAdmin
                ? members.map((member) => ({
                    id: member.id,
                    name: professionalLabel(member),
                  }))
                : undefined
            }
          />
        </section>
      ) : tab === 'visao' && !isPatient ? (
        <section data-panel="visao" id="visao">
          <PtsSheetCards pts={pts} />
        </section>
      ) : (
        <section data-panel="equipe" id="equipe">
          <TeamTable
            ptsId={pts.id}
            members={members}
            responsibleId={pts.responsible.id}
            canManageTeam={canManageTeam}
            onTeamUpdated={handleTeamUpdated}
          />
        </section>
      )}
    </>
  );
}

function TeamTable({
  ptsId,
  members,
  responsibleId,
  canManageTeam,
  onTeamUpdated,
}: {
  ptsId: string;
  members: PtsProfessional[];
  responsibleId: string;
  canManageTeam: boolean;
  onTeamUpdated: (updatedPts: PtsData) => void;
}) {
  const [term, setTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const query = term.trim().toLocaleLowerCase('pt-BR');
  const shown = members.filter(
    (member) =>
      !query ||
      [
        member.name,
        member.registration ? formatRegistration(member.registration) : '',
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query),
  );

  const excludedIds = members.map((member) => member.id);

  return (
    <div className="ux-tcard">
      <div className="ux-tcard-head">
        <div>
          <h2>Equipe multidisciplinar</h2>
          <p className="count" aria-live="polite">
            {members.length}{' '}
            {members.length === 1 ? 'profissional' : 'profissionais'}
          </p>
        </div>

        {canManageTeam && (
          <div className="ux-tools">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setSuccessFeedback(null);
                setIsModalOpen(true);
              }}
            >
              <Icon name="plus" className="icon-sm" />
              Adicionar profissional
            </button>
          </div>
        )}
      </div>

      {successFeedback && (
        <div
          role="status"
          style={{
            margin: '0 1.25rem 1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {successFeedback}
        </div>
      )}

      <div className="ux-toolbar">
        <label className="field">
          <span>Busca</span>
          <span className="with-icon">
            <Icon name="search" className="icon-sm" />
            <input
              className="input"
              type="search"
              placeholder="Nome ou registro"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </span>
        </label>
        <div className="ux-tools" />
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="search" className="icon" />
          </div>
          <h2>Nenhum profissional encontrado</h2>
          <p>Revise a busca.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Profissional</th>
                <th scope="col">Registro</th>
                <th scope="col">Especialidade</th>
                <th scope="col">Papel</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="person">
                      <span className="avatar" aria-hidden="true">
                        {member.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <strong>{member.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td className="nowrap">
                    <RegistrationCell registration={member.registration} />
                  </td>
                  <td>{member.specialism.name}</td>
                  <td>
                    {member.id === responsibleId ? 'Responsável' : 'Membro'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManageTeam && (
        <AddTeamMembersModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          ptsId={ptsId}
          excludedIds={excludedIds}
          onSuccess={(updatedPts) => {
            onTeamUpdated(updatedPts);
            setSuccessFeedback('Equipe atualizada');
          }}
        />
      )}
    </div>
  );
}
