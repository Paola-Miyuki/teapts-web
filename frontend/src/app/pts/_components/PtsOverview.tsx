'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { can } from '@/lib/permissions';
import {
  getActivePts,
  getPtsStatusLabel,
  UUID_PATTERN,
  type ActivePts,
} from '@/lib/pts';

import styles from '../pts.module.css';
import PtsTeamList from './PtsTeamList';
import SocialSituationDialog from './SocialSituationDialog';

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

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

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
  const [editingSocial, setEditingSocial] = useState(false);
  const [feedback, setFeedback] = useState('');

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

  // RFPTS005 – fecha o diálogo, troca o texto na página e avisa.
  function handleSocialSaved(socialSituation: string) {
    setState((current) =>
      current.kind === 'loaded'
        ? { kind: 'loaded', pts: { ...current.pts, socialSituation } }
        : current,
    );
    setEditingSocial(false);
    setFeedback('Situação social atualizada.');
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
  const showSocialSituation =
    !isOwnPts &&
    can(account, 'viewPtsSocialSituation') &&
    pts.socialSituation !== undefined;
  const canEditSocialSituation =
    showSocialSituation &&
    can(account, 'editPtsSocialSituation', {
      pts: {
        status: pts.status,
        responsibleProfessionalId: pts.responsible.id,
        teamProfessionalIds: (pts.team ?? []).map((member) => member.id),
      },
    });
  const acceptedAt = formatDate(pts.acceptedAt);
  const beganAt = formatDate(pts.beganAt);

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
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          <PtsTeamList responsible={pts.responsible} team={pts.team ?? []} />
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

          {showSocialSituation && (
            <>
              <hr className={styles.rule} />

              <h2>Situação social</h2>
              <p className={styles.socialSituation}>
                {pts.socialSituation?.trim() ||
                  'Nenhuma informação registrada.'}
              </p>

              {canEditSocialSituation && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSecondary} ${styles.asideAction}`}
                  onClick={() => {
                    setFeedback('');
                    setEditingSocial(true);
                  }}
                >
                  Editar situação social
                </button>
              )}
            </>
          )}

          <hr className={styles.rule} />

          <p className={styles.muted}>
            O acesso às informações é definido pelo vínculo com o paciente e o
            PTS.
          </p>
        </aside>
      </div>

      {canEditSocialSituation && (
        <SocialSituationDialog
          key={editingSocial ? 'open' : 'closed'}
          open={editingSocial}
          ptsId={pts.id}
          currentValue={pts.socialSituation ?? ''}
          onClose={() => setEditingSocial(false)}
          onSaved={handleSocialSaved}
        />
      )}
    </>
  );
}