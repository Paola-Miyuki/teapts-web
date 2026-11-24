'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import RegistrationCell from '@/components/table/RegistrationCell';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { formatRegistration } from '@/lib/professionals';
import { getPts, type PtsDetail, type PtsProfessional } from '@/lib/pts';
import TimelineTab from './_components/TimelineTab';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

type Tab = 'visao' | 'equipe' | 'timeline';

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
// Metas, atividades, atendimentos e as ações do PTS entram com as tasks deles.
export default function PtsDetailPage({ id }: { id: string }) {
  const [patientName, setPatientName] = useState('');

  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb={[
        { label: 'PTS', href: '/pts/proposals' },
        { label: patientName || 'Detalhe do PTS' },
      ]}
      requiredAction="viewPts"
    >
      {(account, kind) => (
        <PtsDetailContent
          id={id}
          onLoaded={setPatientName}
          isPatient={kind === 'patient'}
          canOpenRecord={can(account, 'viewAuthorizedPatients')}
        />
      )}
    </AuthenticatedPage>
  );
}

function PtsDetailContent({
  id,
  onLoaded,
  isPatient,
  canOpenRecord,
}: {
  id: string;
  onLoaded: (patientName: string) => void;
  isPatient: boolean;
  canOpenRecord: boolean;
}) {
  const router = useRouter();
  const [pts, setPts] = useState<PtsDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);
  // O paciente não vê a ficha (RN028), então não tem a Visão geral.
  const [tab, setTab] = useHashTab(
    isPatient ? ['equipe', 'timeline'] : ['visao', 'equipe', 'timeline'],
  );

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

  return (
    <>
      <section className="ux-card ux-ptshead" aria-labelledby="pts-title">
        <div className="ux-ptshead-main">
          <span className="ux-ptsicon" aria-hidden="true">
            <Icon name="pts" />
          </span>
          <div>
            <h1 id="pts-title">PTS de {pts.patient.name}</h1>
            <div className="ux-badges">
              <PtsStatusBadge status={pts.status} />
            </div>
          </div>
        </div>

        <dl className="ux-dl">
          <Item label="Responsável">{professionalLabel(pts.responsible)}</Item>
          <Item label="Criado em">{formatDate(pts.createdAt)}</Item>
          <Item label="Início">{pts.beganAt && formatDate(pts.beganAt)}</Item>
          {pts.concludedAt && (
            <Item label="Concluído em">{formatDate(pts.concludedAt)}</Item>
          )}
          {pts.cancelledAt && (
            <Item label="Cancelado em">{formatDate(pts.cancelledAt)}</Item>
          )}
          {pts.rejectedAt && (
            <Item label="Rejeitado em">{formatDate(pts.rejectedAt)}</Item>
          )}
        </dl>

        {canOpenRecord && (
          <div className="heading-actions">
            <Link className="btn" href={`/patients/${pts.patient.id}`}>
              <Icon name="patient" className="icon-sm" />
              Prontuário
            </Link>
          </div>
        )}
      </section>

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
          <TimelineTab
            ptsId={pts.id}
            patientId={pts.patient.id}
            team={members.map(({ id: memberId, name }) => ({
              id: memberId,
              name,
            }))}
            isPatient={isPatient}
          />
        </section>
      ) : tab === 'visao' && !isPatient ? (
        <section data-panel="visao" id="visao">
          <div className="ux-stack">
            <section className="ux-card" aria-labelledby="pv-social">
              <div className="ux-card-head">
                <div>
                  <span className="ux-titletip">
                    <h2 id="pv-social">Situação social</h2>
                    <HelpTooltip id="pv-social-tip" label="Situação social">
                      A situação social não aparece ao paciente.
                    </HelpTooltip>
                  </span>
                </div>
              </div>
              <div className="ux-psec">
                <p className="ux-ptext">
                  {pts.socialSituation || <EmptyCell />}
                </p>
              </div>
            </section>
          </div>
        </section>
      ) : (
        <section data-panel="equipe" id="equipe">
          <TeamTable members={members} responsibleId={pts.responsible.id} />
        </section>
      )}
    </>
  );
}

function TeamTable({
  members,
  responsibleId,
}: {
  members: PtsProfessional[];
  responsibleId: string;
}) {
  const [term, setTerm] = useState('');
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
      </div>

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
    </div>
  );
}
