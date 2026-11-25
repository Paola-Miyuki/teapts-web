'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import GoalResultCard, {
  GOAL_RESULT_OPTIONS,
} from '@/components/pts/GoalResultCard';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { formatDateOnly, todayDateOnly } from '@/lib/format';
import {
  GOAL_AREA_LABELS,
  GOAL_STATUS_BADGES,
  GOAL_TERM_LABELS,
  getGoals,
  type Goal,
} from '@/lib/goals';
import { can } from '@/lib/permissions';
import {
  getPts,
  getPtsStatusLabel,
  registerReassessment,
  type GoalResult,
  type PtsDetail,
} from '@/lib/pts';

// Passos de `reavaliacao.html`.
const STEPS = ['Resultado das metas', 'Encerrar'] as const;

type Step = 0 | 1;
type LoadStatus = 'loading' | 'ready' | 'error';
type Choice = 'next' | 'close';

const LOAD_ERROR = 'Não foi possível carregar o PTS';
const SAVE_ERROR = 'Não foi possível registrar a reavaliação';
const NOT_ALLOWED =
  'A reavaliação só é registrada com o PTS em andamento, pelo responsável ou pelo administrador';

function missingLabel(missing: number) {
  if (missing === 0) {
    return 'Todas as metas têm resultado.';
  }

  return missing === 1
    ? 'Falta 1 meta sem resultado.'
    : `Faltam ${missing} metas sem resultado.`;
}

// Tela "Registrar reavaliação" (RFEVA005): resultado de cada meta e o
// encerramento do ciclo, com ou sem o rascunho da próxima versão.
export default function ReassessmentPage({
  ptsId,
  account,
}: {
  ptsId: string;
  account: Account;
}) {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [pts, setPts] = useState<PtsDetail | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [step, setStep] = useState<Step>(0);
  const [meetingDate, setMeetingDate] = useState(todayDateOnly);
  const [results, setResults] = useState<Record<string, GoalResult>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getPts(ptsId, controller.signal),
      getGoals(ptsId, controller.signal),
    ])
      .then(([loaded, { data }]) => {
        if (controller.signal.aborted) {
          return;
        }

        const allowed =
          loaded.status === 'running' &&
          can(account, 'registerPtsReassessment', {
            pts: {
              status: loaded.status,
              responsibleProfessionalId: loaded.responsible.id,
              teamProfessionalIds: loaded.team.map((member) => member.id),
            },
          });

        if (!allowed) {
          setLoadError(NOT_ALLOWED);
          setLoadStatus('error');
          return;
        }

        setPts(loaded);
        // Só as metas em andamento recebem resultado na reavaliação.
        setGoals(data.filter((goal) => goal.status === 'in_progress'));
        setLoadError('');
        setLoadStatus('ready');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setLoadError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : LOAD_ERROR,
        );
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [account, ptsId, reloadKey, router]);

  async function confirm() {
    if (!pts || !choice || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const { nextPtsId } = await registerReassessment(pts.id, {
        meetingDate,
        goals: goals.map((goal) => ({
          goalId: goal.id,
          status: results[goal.id],
          ...(notes[goal.id]?.trim() && { note: notes[goal.id].trim() }),
        })),
        createNextVersion: choice === 'next',
        ...(reason.trim() && { reason: reason.trim() }),
      });

      // Com a próxima versão, abre o rascunho nos quatro passos (RFPTS013).
      router.push(
        nextPtsId ? `/pts/proposals/${nextPtsId}/edit` : `/pts/${pts.id}`,
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setSubmitError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : SAVE_ERROR,
      );
      setSubmitting(false);
    }
  }

  const heading = (
    <div className="heading">
      <div>
        <h1>Registrar reavaliação</h1>
      </div>
      <div className="heading-actions">
        <Link className="btn" href={`/pts/${ptsId}`}>
          Cancelar
        </Link>
      </div>
    </div>
  );

  if (loadStatus === 'loading') {
    return (
      <>
        {heading}
        <div className={ui.empty} role="status">
          <p>Carregando PTS...</p>
        </div>
      </>
    );
  }

  if (loadStatus === 'error' || !pts) {
    return (
      <>
        {heading}
        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível registrar a reavaliação</h2>
          <p>{loadError || LOAD_ERROR}</p>
          {loadError === NOT_ALLOWED ? (
            <Link
              className={`${ui.btn} ${ui.btnSecondary}`}
              href={`/pts/${ptsId}`}
            >
              Voltar para o PTS
            </Link>
          ) : (
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={() => {
                setLoadStatus('loading');
                setReloadKey((current) => current + 1);
              }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      </>
    );
  }

  const version = pts.version ?? 1;
  const missing = goals.filter((goal) => !results[goal.id]).length;
  const kept = goals.filter((goal) => results[goal.id] !== 'achieved').length;
  const resultLabel = (goal: Goal) =>
    GOAL_RESULT_OPTIONS.find((option) => option.value === results[goal.id])
      ?.label;

  return (
    <>
      {heading}

      <section className="ux-card ux-rv-summary" aria-label="PTS reavaliado">
        <dl className="ux-dl">
          <div>
            <dt>Paciente</dt>
            <dd>{pts.patient.name}</dd>
          </div>
          <div>
            <dt>PTS</dt>
            <dd>{`PTS v${version}, ${getPtsStatusLabel(pts.status).toLowerCase()}`}</dd>
          </div>
          <div>
            <dt>Responsável</dt>
            <dd>{`${pts.responsible.name}, ${pts.responsible.specialism.name}`}</dd>
          </div>
          {pts.nextReviewAt && (
            <div>
              <dt>Próxima revisão</dt>
              <dd>{formatDateOnly(pts.nextReviewAt)}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="ux-formcard ux-wz-step" aria-labelledby="rv-title">
        <div className="ux-wz-head">
          <ol
            className="ux-steps ux-steps-2"
            aria-label={`Passo ${step + 1} de ${STEPS.length}`}
          >
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={index < step ? 'is-done' : undefined}
                aria-current={index === step ? 'step' : undefined}
              >
                <span className="ux-step-n">
                  {index < step ? <Icon name="check" /> : index + 1}
                </span>
                <span className="ux-step-l">{label}</span>
              </li>
            ))}
          </ol>
          <div>
            <h2 id="rv-title">
              {step === 0 ? 'Resultado das metas' : 'Encerrar o ciclo'}
            </h2>
          </div>
        </div>

        {step === 0 ? (
          <div className="ux-wz-body">
            <div
              className="form-grid"
              style={{ maxWidth: 340, marginBottom: 18 }}
            >
              <FormField id="rv-date" label="Data do encontro da equipe" full>
                <input
                  className="input"
                  id="rv-date"
                  type="date"
                  aria-required="true"
                  value={meetingDate}
                  onChange={(event) => setMeetingDate(event.target.value)}
                />
              </FormField>
            </div>

            <p
              id="rv-missing"
              className={missing === 0 ? 'ux-missing is-ok' : 'ux-missing'}
              role="status"
            >
              {missingLabel(missing)}
            </p>

            <ul className="ux-goals">
              {goals.map((goal) => (
                <GoalResultCard
                  key={goal.id}
                  goal={goal}
                  result={results[goal.id]}
                  note={notes[goal.id] ?? ''}
                  onResultChange={(result) =>
                    setResults((current) => ({ ...current, [goal.id]: result }))
                  }
                  onNoteChange={(note) =>
                    setNotes((current) => ({ ...current, [goal.id]: note }))
                  }
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="ux-wz-body">
            <ul className="mini-list">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <span className="grow">
                    <strong>{goal.title}</strong>
                    {goal.term && (
                      <small className="ux-sub">
                        <span className="ux-sublabel">Prazo:</span>{' '}
                        {GOAL_TERM_LABELS[goal.term]}
                      </small>
                    )}
                    <small className="ux-sub">
                      <span className="ux-sublabel">Área:</span>{' '}
                      {GOAL_AREA_LABELS[goal.area]}
                    </small>
                  </span>
                  <span
                    className={`badge ${GOAL_STATUS_BADGES[results[goal.id]]}`}
                  >
                    {resultLabel(goal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="form-grid" style={{ marginTop: 18 }}>
              <FormField
                id="rv-reason"
                label="Motivo do encerramento"
                required={false}
                full
              >
                <textarea
                  className="input"
                  id="rv-reason"
                  rows={3}
                  placeholder="Ex.: metas do ciclo atingidas"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
            </div>

            <div className="ux-choice">
              <div className="ux-card">
                <h3>{`Encerrar ciclo e criar PTS v${version + 1}`}</h3>
                <p>
                  {`Abre o rascunho da v${version + 1} já preenchido: diagnóstico para atualizar, ${
                    kept === 1
                      ? 'a meta parcial ou não atingida'
                      : `as ${kept} metas parciais e não atingidas`
                  } sem prazo nem data-alvo, a mesma equipe e as atividades em andamento.`}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSubmitError('');
                    setChoice('next');
                  }}
                >
                  <Icon name="pts" className="icon-sm" />
                  {`Encerrar e criar PTS v${version + 1}`}
                </button>
              </div>
              <div className="ux-card">
                <h3>Encerrar sem novo PTS</h3>
                <p>
                  {`Só conclui o PTS v${version}. Um próximo PTS, se houver, é criado do zero pela tela de propostas.`}
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSubmitError('');
                    setChoice('close');
                  }}
                >
                  <Icon name="lock" className="icon-sm" />
                  Encerrar sem novo PTS
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="ux-formcard-foot ux-wz-foot">
          {step === 0 ? (
            <>
              <Link className="btn" href={`/pts/${ptsId}`}>
                Cancelar
              </Link>
              {/* O encerramento só é liberado com todas as metas avaliadas. */}
              <button
                type="button"
                className="btn btn-primary"
                disabled={missing > 0 || !meetingDate}
                aria-describedby="rv-missing"
                onClick={() => setStep(1)}
              >
                Próximo
                <Icon name="chevronRight" className="icon-sm" />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => setStep(0)}>
                <Icon name="chevronLeft" className="icon-sm" />
                Voltar
              </button>
              <span />
            </>
          )}
        </div>
      </section>

      {choice && (
        <Modal
          open
          id="rv-confirm"
          size="sm"
          title={
            choice === 'next'
              ? `Encerrar e criar o PTS v${version + 1}?`
              : 'Encerrar sem novo PTS?'
          }
          description={
            choice === 'next'
              ? `O PTS v${version} é concluído com o resultado das metas e o rascunho da v${version + 1} abre para a equipe revisar.`
              : `O PTS v${version} é concluído e fica só para leitura, com o resultado das metas. Nenhum rascunho é criado.`
          }
          busy={submitting}
          onClose={() => setChoice(null)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => setChoice(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={
                  choice === 'next' ? 'btn btn-primary' : 'btn btn-danger'
                }
                disabled={submitting}
                aria-busy={submitting}
                onClick={confirm}
              >
                {submitting
                  ? 'Encerrando...'
                  : choice === 'next'
                    ? `Encerrar e criar PTS v${version + 1}`
                    : 'Encerrar sem novo PTS'}
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
