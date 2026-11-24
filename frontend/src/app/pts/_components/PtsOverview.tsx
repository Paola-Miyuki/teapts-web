'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import TimelineTab from '@/components/pts/TimelineTab';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import {
  getActivePts,
  getPtsStatusLabel,
  UUID_PATTERN,
  type ActivePts,
  type PtsProfessional,
  type PtsTeamResponse,
} from '@/lib/pts';

import styles from '../pts.module.css';
import PtsSheetCards from './PtsSheetCards';
import PtsTeamList from './PtsTeamList';
import RemoveTeamMemberDialog from './RemoveTeamMemberDialog';
import TransferResponsibilityModal from './TransferResponsibilityModal';

type PtsOverviewProps = {
  account: Account;
  // Paciente: o patientProfileId da conta. Profissional: o da rota.
  patientId: string | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; pts: ActivePts }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string };

const LOAD_ERROR = 'Não foi possível carregar o PTS ativo.';

function StateCard({
  title,
  message,
  error = false,
  children,
}: {
  title: string;
  message: string;
  error?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={styles.stateCard} role={error ? 'alert' : 'status'}>
      <div className={error ? styles.errorIcon : styles.stateIcon}>
        <Icon name={error ? 'alertCircle' : 'clipboard'} />
      </div>

      <h2>{title}</h2>
      <p>{message}</p>

      {children}
    </div>
  );
}

// Visão geral do PTS ativo (RFPTS004), conforme frontend/design/pts.html.
export default function PtsOverview({ account, patientId }: PtsOverviewProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [removingMember, setRemovingMember] = useState<PtsProfessional | null>(
    null,
  );
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const validPatientId = Boolean(patientId && UUID_PATTERN.test(patientId));
  const isOwnPts =
    account.patientProfileId !== null && account.patientProfileId === patientId;

  useEffect(() => {
    if (!patientId || !validPatientId) {
      return;
    }

    let cancelled = false;

    getActivePts(patientId)
      .then((pts) => {
        if (!cancelled) {
          setState({ kind: 'loaded', pts });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: 'notFound' });
          return;
        }

        setState({
          kind: 'error',
          message:
            error instanceof ApiError && error.apiMessage
              ? error.apiMessage
              : LOAD_ERROR,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, validPatientId, retryKey, router]);

  function handleRetry() {
    setState({ kind: 'loading' });
    setRetryKey((current) => current + 1);
  }

  // RFEM003 – mostra a equipe da resposta e avisa.
  function handleMemberRemoved(team: PtsTeamResponse) {
    setState((current) =>
      current.kind === 'loaded'
        ? {
            kind: 'loaded',
            pts: {
              ...current.pts,
              responsible: team.responsible,
              team: team.team,
            },
          }
        : current,
    );
    setRemovingMember(null);
    setFeedback('Profissional removido da equipe.');
  }

  function handleResponsibilityTransferred(team: PtsTeamResponse) {
    setState((current) =>
      current.kind === 'loaded'
        ? {
            kind: 'loaded',
            pts: {
              ...current.pts,
              responsible: team.responsible,
              team: team.team,
            },
          }
        : current,
    );
    setIsTransferModalOpen(false);
    setFeedback('Responsabilidade transferida.');
  }

  if (!patientId) {
    return (
      <StateCard
        title="Nenhum paciente selecionado"
        message="Escolha um paciente para ver o PTS ativo dele."
      />
    );
  }

  if (!validPatientId) {
    return (
      <StateCard
        error
        title="Paciente inválido"
        message="O identificador do paciente informado não é válido."
      />
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className={styles.stateCard} role="status">
        <p>Carregando o PTS ativo...</p>
      </div>
    );
  }

  if (state.kind === 'notFound') {
    return (
      <StateCard
        title="Nenhum PTS ativo"
        message={
          isOwnPts
            ? 'Você ainda não tem um PTS ativo. Confira as propostas e escolha a equipe que vai construir esse caminho com você.'
            : 'Este paciente ainda não tem um PTS ativo.'
        }
      >
        {isOwnPts && (
          <Link
            href="/pts/proposals"
            className={`${ui.btn} ${ui.btnPrimary} ${styles.stateAction}`}
          >
            Ver propostas de PTS
          </Link>
        )}
      </StateCard>
    );
  }

  if (state.kind === 'error') {
    return (
      <StateCard
        error
        title="Algo não saiu como esperado"
        message={state.message}
      >
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary} ${styles.stateAction}`}
          onClick={handleRetry}
        >
          Tentar novamente
        </button>
      </StateCard>
    );
  }

  const { pts } = state;
  // RN028 – o paciente não vê a ficha.
  const showSheet =
    !isOwnPts &&
    can(account, 'viewPtsSheet') &&
    pts.diagnosisSummary !== undefined;
  const canEditPts = can(account, 'editPts', {
    pts: {
      status: pts.status,
      responsibleProfessionalId: pts.responsible.id,
      teamProfessionalIds: (pts.team ?? []).map((member) => member.id),
    },
  });
  const canRemoveTeamMember = can(account, 'removePtsTeamMember', {
    pts: {
      status: pts.status,
      responsibleProfessionalId: pts.responsible.id,
    },
  });
  const canTransferResponsibility =
    (account.role === 'admin' ||
      account.professionalProfileIds.includes(pts.responsible.id)) &&
    ['planning', 'running'].includes(pts.status.toLowerCase());
  const acceptedAt = pts.acceptedAt && formatDate(pts.acceptedAt);
  const beganAt = pts.beganAt && formatDate(pts.beganAt);

  return (
    <>
      {feedback && (
        <div
          className={`${ui.alert} ${ui.alertSuccess} ${styles.feedback}`}
          role="status"
          aria-live="polite"
        >
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{feedback}</span>
        </div>
      )}

      <div className={styles.personBanner}>
        <span className={styles.patientAvatar}>
          <Image
            src="/assets/avatar-paciente.png"
            width={42}
            height={74}
            alt=""
          />
        </span>

        <div>
          <h2>{pts.patient.name || 'Paciente não informado'}</h2>
          <p>Programa Terapêutico Singular</p>
        </div>

        <span className={styles.statusBadge}>
          {getPtsStatusLabel(pts.status)}
        </span>

        {canEditPts && (
          <Link
            href={`/pts/${pts.id}/edit`}
            className={`${ui.btn} ${ui.btnSecondary}`}
          >
            Editar PTS
          </Link>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          <PtsTeamList
            responsible={pts.responsible}
            team={pts.team ?? []}
            onRemove={
              canRemoveTeamMember
                ? (member) => {
                    setFeedback('');
                    setRemovingMember(member);
                  }
                : undefined
            }
            onTransferResponsibility={
              canTransferResponsibility
                ? () => {
                    setFeedback('');
                    setIsTransferModalOpen(true);
                  }
                : undefined
            }
          />

          {showSheet && <PtsSheetCards pts={pts} />}

          <section id="timeline" aria-label="Timeline">
            <TimelineTab
              ptsId={pts.id}
              patientId={pts.patient.id}
              team={[pts.responsible, ...(pts.team ?? [])].map(
                ({ id, name }) => ({ id, name }),
              )}
              isPatient={isOwnPts}
            />
          </section>
        </div>

        <aside className={styles.aside} aria-labelledby="pts-about-title">
          <h2 id="pts-about-title">Sobre este plano</h2>

          <dl className={styles.details}>
            <div>
              <dt>Paciente</dt>
              <dd>{pts.patient.name || 'Paciente não informado'}</dd>
            </div>

            <div>
              <dt>Situação</dt>
              <dd>{getPtsStatusLabel(pts.status)}</dd>
            </div>

            <div>
              <dt>Profissional responsável</dt>
              <dd>
                {pts.responsible.name || 'Não informado'}
                {pts.responsible.specialism?.name &&
                  ` · ${pts.responsible.specialism.name}`}
              </dd>
            </div>

            {acceptedAt && (
              <div>
                <dt>Aceito em</dt>
                <dd>{acceptedAt}</dd>
              </div>
            )}

            {beganAt && (
              <div>
                <dt>Iniciado em</dt>
                <dd>{beganAt}</dd>
              </div>
            )}
          </dl>

          <hr className={styles.rule} />

          <p className={styles.muted}>
            O acesso às informações é definido pelo vínculo com o paciente e o
            PTS.
          </p>
        </aside>
      </div>

      {canRemoveTeamMember && (
        <RemoveTeamMemberDialog
          key={
            removingMember?.id ? `remove-${removingMember.id}` : 'remove-closed'
          }
          ptsId={pts.id}
          member={removingMember}
          onClose={() => setRemovingMember(null)}
          onRemoved={handleMemberRemoved}
        />
      )}

      {canTransferResponsibility && isTransferModalOpen && (
        <TransferResponsibilityModal
          open
          ptsId={pts.id}
          currentResponsibleId={pts.responsible.id}
          onClose={() => setIsTransferModalOpen(false)}
          onTransferred={handleResponsibilityTransferred}
        />
      )}
    </>
  );
}
