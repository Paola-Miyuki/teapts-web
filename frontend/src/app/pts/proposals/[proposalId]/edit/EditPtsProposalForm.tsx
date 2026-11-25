'use client';

import { useEffect, useRef, useState } from 'react';

import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Icon from '@/components/Icon';
import GoalsStep from '@/components/pts/GoalsStep';
import TeamMembers from '@/components/pts/TeamMembers';
import WizardSteps, {
  PROPOSAL_STEPS,
  type ProposalStep,
} from '@/components/pts/WizardSteps';
import ui from '@/components/ui.module.css';
import { useActivities } from '@/hooks/useActivities';
import { useGoals } from '@/hooks/useGoals';

import type { Account } from '@/lib/account';
import {
  ACTIVITY_EXECUTOR_LABELS,
  ACTIVITY_TYPE_LABELS,
  formatFrequency,
} from '@/lib/activities';
import { ApiError } from '@/lib/api';
import { addMonths } from '@/lib/format';
import { isGoalIncomplete } from '@/lib/goals';
import { can } from '@/lib/permissions';
import { getPts, type PtsDetail } from '@/lib/pts';

import { initSuperTokens } from '@/lib/supertokens';

import {
  SheetDiagnosisFields,
  SheetProfileFields,
  toSheetForm,
  toSheetInput,
  type SheetErrors,
  type SheetForm,
} from '../../../_components/SheetFields';
import {
  getProfessionalsForTeam,
  PtsProposalApiError,
  updatePtsProposal,
} from './api';

import type { Professional } from './types';

type EditPtsProposalFormProps = {
  proposalId: string;
  account: Account;
};

type LoadStatus = 'loading' | 'ready' | 'error';

const LOAD_ERROR = 'Não foi possível carregar os dados da proposta';
const REVIEW_SHORTCUTS = [3, 6, 12];

const FIELD_IDS: Record<keyof SheetErrors, string> = {
  caseStudyDate: 'edit-study',
  diagnosisSummary: 'sheet-summary',
  socialSituation: 'sheet-social',
  nextReviewAt: 'edit-review',
};

function isUnauthorized(error: unknown) {
  return (
    (error instanceof PtsProposalApiError && error.statusCode === 401) ||
    (error instanceof ApiError && error.status === 401)
  );
}

function validate(step: ProposalStep, form: SheetForm): SheetErrors {
  const found: SheetErrors = {};

  if (step === 0 && !form.caseStudyDate) {
    found.caseStudyDate = 'Informe a data do estudo de caso';
  }

  if (step === 1 && !form.diagnosisSummary.trim()) {
    found.diagnosisSummary = 'Descreva a síntese do diagnóstico';
  }

  if (step === 1 && !form.socialSituation.trim()) {
    found.socialSituation = 'Descreva a situação social do paciente';
  }

  if (step === 3 && !form.nextReviewAt) {
    found.nextReviewAt = 'Informe a próxima revisão';
  }

  return found;
}

// Editar proposta nos 4 passos (RFPTS007): também o rascunho da próxima versão,
// que chega preenchido (RFPTS013).
export default function EditPtsProposalForm({
  proposalId,
  account,
}: EditPtsProposalFormProps) {
  const router = useRouter();

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');

  const [reloadKey, setReloadKey] = useState(0);

  const [proposal, setProposal] = useState<PtsDetail | null>(null);

  const [form, setForm] = useState<SheetForm | null>(null);

  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [teamIds, setTeamIds] = useState<string[]>([]);

  const [errors, setErrors] = useState<SheetErrors>({});

  const [goalsError, setGoalsError] = useState('');

  const [loadError, setLoadError] = useState('');

  const [submitError, setSubmitError] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const [step, setStep] = useState<ProposalStep>(0);

  const errorRef = useRef<HTMLDivElement>(null);

  const {
    goals,
    error: goalsLoadError,
    reload: reloadGoals,
  } = useGoals(proposalId);
  const { activities } = useActivities(proposalId, {
    page: 1,
    limit: 50,
  });

  useEffect(() => {
    initSuperTokens();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getPts(proposalId, controller.signal),

      getProfessionalsForTeam(controller.signal),
    ])
      .then(([loadedProposal, loadedProfessionals]) => {
        if (controller.signal.aborted) {
          return;
        }

        if (loadedProposal.status !== 'draft') {
          setLoadError(
            'Somente propostas aguardando decisão podem ser editadas',
          );

          setLoadStatus('error');

          return;
        }

        const canEdit = can(account, 'editPtsProposal', {
          pts: {
            status: 'draft',
            responsibleProfessionalId: loadedProposal.responsible.id,
          },
        });

        if (!canEdit) {
          setLoadError(
            'Somente o profissional responsável pode editar esta proposta',
          );

          setLoadStatus('error');

          return;
        }

        setProposal(loadedProposal);

        setForm(toSheetForm(loadedProposal));

        setProfessionals(
          loadedProfessionals.filter(
            (professional) => professional.id !== loadedProposal.responsible.id,
          ),
        );

        setTeamIds(
          loadedProposal.team
            .map((member) => member.id)
            .filter((id) => id !== loadedProposal.responsible.id),
        );

        setLoadError('');
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (isUnauthorized(error)) {
          router.replace('/login');

          return;
        }

        if (error instanceof PtsProposalApiError) {
          setLoadError(error.message);
        } else {
          setLoadError(
            error instanceof ApiError && error.apiMessage
              ? error.apiMessage
              : LOAD_ERROR,
          );
        }

        setLoadStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [account, proposalId, reloadKey, router]);

  useEffect(() => {
    if (submitError) {
      errorRef.current?.focus();
    }
  }, [submitError]);

  function handleRetry() {
    setProposal(null);
    setForm(null);
    setLoadError('');
    setSubmitError('');
    setLoadStatus('loading');

    setReloadKey((current) => current + 1);
  }

  function update<K extends keyof SheetForm>(key: K, value: SheetForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  const pendingGoals = (goals ?? []).filter(isGoalIncomplete).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || !proposal || !form) {
      return;
    }

    const found = validate(step, form);
    const [firstError] = Object.keys(found) as (keyof SheetErrors)[];

    setErrors(found);
    setSubmitError('');
    setGoalsError('');

    if (firstError) {
      document.getElementById(FIELD_IDS[firstError])?.focus();

      return;
    }

    if (step === 2 && pendingGoals > 0) {
      setGoalsError(
        `Defina o prazo e a data-alvo de todas as metas (${
          pendingGoals === 1 ? 'falta 1' : `faltam ${pendingGoals}`
        })`,
      );

      return;
    }

    if (step < 3) {
      setStep((step + 1) as ProposalStep);

      return;
    }

    setIsSaving(true);

    try {
      await updatePtsProposal(proposal.id, {
        ...toSheetInput(form),
        teamProfessionalIds: teamIds,
      });

      router.push('/pts/proposals?updated=1');
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        router.replace('/login');

        return;
      }

      setSubmitError(
        error instanceof PtsProposalApiError
          ? error.message
          : 'Não foi possível atualizar a proposta de PTS',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const heading = (
    <div className="heading">
      <div>
        <h1>
          {proposal?.previousPts
            ? `PTS v${proposal.version} de ${proposal.patient.name}`
            : 'Editar proposta de PTS'}
        </h1>
      </div>
      <div className="heading-actions">
        <Link className="btn" href="/pts/proposals">
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
          <p>Carregando proposta...</p>
        </div>
      </>
    );
  }

  if (loadStatus === 'error' || !proposal || !form) {
    return (
      <>
        {heading}

        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível editar a proposta</h2>

          <p>{loadError || 'Não foi possível carregar a proposta'}</p>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      </>
    );
  }

  let body;

  if (step === 0) {
    body = (
      <>
        <dl className="ux-summary">
          <div>
            <dt>Paciente</dt>
            <dd>{proposal.patient.name}</dd>
          </div>
        </dl>
        <div className="form-grid">
          <FormField
            id="edit-study"
            label={
              proposal.previousPts
                ? 'Data do novo estudo de caso'
                : 'Data do estudo de caso'
            }
            help="Dia da reunião em que a equipe decidiu o diagnóstico."
            error={errors.caseStudyDate}
            full
          >
            <input
              className="input"
              id="edit-study"
              type="date"
              aria-required="true"
              aria-invalid={Boolean(errors.caseStudyDate)}
              value={form.caseStudyDate}
              onChange={(event) => update('caseStudyDate', event.target.value)}
            />
          </FormField>
        </div>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <div className="form-grid">
          <SheetDiagnosisFields
            form={form}
            errors={errors}
            disabled={isSaving}
            update={update}
          />
        </div>
        <SheetProfileFields
          form={form}
          errors={errors}
          disabled={isSaving}
          update={update}
        />
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        {goalsError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{goalsError}</p>
          </div>
        )}
        <GoalsStep
          ptsId={proposal.id}
          goals={goals}
          error={goalsLoadError}
          reload={() => {
            setGoalsError('');
            reloadGoals();
          }}
          nextReviewAt={proposal.nextReviewAt}
          previousVersion={proposal.previousPts?.version}
          priorityNeeds={form.priorityNeeds}
          authors={
            account.role === 'admin'
              ? [proposal.responsible, ...proposal.team].map((member) => ({
                  id: member.id,
                  name: `${member.name}, ${member.specialism.name}`,
                }))
              : undefined
          }
        />
      </>
    );
  } else {
    body = (
      <>
        <section className="ux-fsection">
          <header>
            <h3>Responsável</h3>
          </header>
          <div>
            <div className="field">
              <label className="field-label" htmlFor="edit-responsible">
                Profissional responsável
              </label>
              <input
                className="input"
                id="edit-responsible"
                type="text"
                readOnly
                value={`${proposal.responsible.name} · ${proposal.responsible.specialism.name}`}
              />
            </div>
          </div>
        </section>

        <TeamMembers
          professionals={professionals}
          selectedIds={teamIds}
          onChange={setTeamIds}
          disabled={isSaving}
        />

        <section className="ux-fsection">
          <header>
            <h3>Data máxima do PTS</h3>
          </header>
          <div>
            <div className="form-grid">
              <FormField
                id="edit-review"
                label="Data máxima (próxima revisão)"
                error={errors.nextReviewAt}
              >
                <input
                  className="input"
                  id="edit-review"
                  type="date"
                  aria-required="true"
                  aria-invalid={Boolean(errors.nextReviewAt)}
                  disabled={isSaving}
                  value={form.nextReviewAt}
                  onChange={(event) =>
                    update('nextReviewAt', event.target.value)
                  }
                />
              </FormField>

              <div className="field">
                <span className="field-label">
                  Atalhos a partir do estudo de caso
                </span>
                <div className="ux-inline">
                  {REVIEW_SHORTCUTS.map((months) => (
                    <button
                      key={months}
                      type="button"
                      className="btn btn-sm"
                      disabled={isSaving}
                      onClick={() =>
                        update(
                          'nextReviewAt',
                          addMonths(form.caseStudyDate, months),
                        )
                      }
                    >
                      {`${months} meses`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {proposal.previousPts && activities && activities.length > 0 && (
          <section className="ux-fsection">
            <header>
              <h3>Atividades copiadas</h3>
            </header>
            <div>
              <ul className="mini-list">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <span className="grow">
                      <strong>{activity.title}</strong>
                      <small className="ux-sub">
                        {`Tipo: ${ACTIVITY_TYPE_LABELS[activity.type]}`}
                      </small>
                      <small className="ux-sub">
                        {`Frequência: ${formatFrequency(activity.frequency)}`}
                      </small>
                    </span>
                    <span className="badge plain">
                      {ACTIVITY_EXECUTOR_LABELS[activity.executor]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {heading}

      {submitError ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className={`${ui.alert} ${ui.alertError}`}
        >
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>
          <span>{submitError}</span>
        </div>
      ) : null}

      {/* Os diálogos das metas têm o próprio formulário: ficam fora deste. */}
      <form id="proposal-form" onSubmit={handleSubmit} noValidate />

      <section className="ux-formcard ux-wz-step" aria-labelledby="wz-title">
        <div className="ux-wz-head">
          <WizardSteps current={step} steps={PROPOSAL_STEPS} />
          <div>
            <h2 id="wz-title">{PROPOSAL_STEPS[step]}</h2>
          </div>
        </div>

        <div className="ux-wz-body">{body}</div>

        <div className="ux-formcard-foot ux-wz-foot">
          {step > 0 ? (
            <button
              type="button"
              className="btn"
              disabled={isSaving}
              onClick={() => {
                setErrors({});
                setGoalsError('');
                setStep((step - 1) as ProposalStep);
              }}
            >
              <Icon name="chevronLeft" className="icon-sm" />
              Voltar
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              type="submit"
              form="proposal-form"
              className="btn btn-primary"
              disabled={step === 2 && !goals}
            >
              Próximo
              <Icon name="chevronRight" className="icon-sm" />
            </button>
          ) : (
            <button
              type="submit"
              form="proposal-form"
              disabled={isSaving}
              aria-busy={isSaving}
              className="btn btn-primary"
            >
              <Icon name="check" className="icon-sm" />
              {isSaving ? 'Salvando...' : 'Salvar proposta'}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
