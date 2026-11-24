'use client';

import { useEffect, useRef, useState } from 'react';

import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import TeamMembers from '@/components/pts/TeamMembers';
import WizardSteps, {
  PTS_STEPS,
  type PtsStep,
} from '@/components/pts/WizardSteps';
import ui from '@/components/ui.module.css';

import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';

import { initSuperTokens } from '@/lib/supertokens';

import {
  getProfessionalsForTeam,
  getPtsProposal,
  PtsProposalApiError,
  updatePtsProposal,
} from './api';

import type { Professional, PtsProposal } from './types';

type EditPtsProposalFormProps = {
  proposalId: string;
  account: Account;
};

type LoadStatus = 'loading' | 'ready' | 'error';

export default function EditPtsProposalForm({
  proposalId,
  account,
}: EditPtsProposalFormProps) {
  const router = useRouter();

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');

  const [reloadKey, setReloadKey] = useState(0);

  const [proposal, setProposal] = useState<PtsProposal | null>(null);

  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [socialSituation, setSocialSituation] = useState('');

  const [teamIds, setTeamIds] = useState<string[]>([]);

  const [socialError, setSocialError] = useState('');

  const [loadError, setLoadError] = useState('');

  const [submitError, setSubmitError] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const [step, setStep] = useState<PtsStep>(0);

  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initSuperTokens();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getPtsProposal(proposalId, controller.signal),

      getProfessionalsForTeam(controller.signal),
    ])
      .then(([loadedProposal, loadedProfessionals]) => {
        if (controller.signal.aborted) {
          return;
        }

        if (loadedProposal.status.toUpperCase() !== 'DRAFT') {
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

        const teamOptions = loadedProfessionals.filter(
          (professional) => professional.id !== loadedProposal.responsible.id,
        );

        const initialTeamIds = loadedProposal.team
          .map((member) => member.id)
          .filter(
            (professionalId) =>
              professionalId !== loadedProposal.responsible.id,
          );

        setProposal(loadedProposal);

        setProfessionals(teamOptions);

        setSocialSituation(loadedProposal.socialSituation ?? '');

        setTeamIds(initialTeamIds);

        setLoadError('');
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof PtsProposalApiError && error.statusCode === 401) {
          router.replace('/login');

          return;
        }

        if (error instanceof PtsProposalApiError) {
          setLoadError(error.message);
        } else {
          setLoadError('Não foi possível carregar os dados da proposta');
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
    setProfessionals([]);
    setSocialSituation('');
    setTeamIds([]);
    setSocialError('');
    setLoadError('');
    setSubmitError('');
    setLoadStatus('loading');

    setReloadKey((current) => current + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || !proposal) {
      return;
    }

    const trimmedSocialSituation = socialSituation.trim();

    setSocialError('');
    setSubmitError('');

    if (step >= 1 && !trimmedSocialSituation) {
      setSocialError('Descreva a situação social do paciente');
      setStep(1);

      document.getElementById('edit-social-situation')?.focus();

      return;
    }

    if (step < 2) {
      setStep((step + 1) as PtsStep);

      return;
    }

    const validTeamIds = teamIds.filter(
      (professionalId) => professionalId !== proposal.responsible.id,
    );

    setIsSaving(true);

    try {
      await updatePtsProposal(proposal.id, {
        socialSituation: trimmedSocialSituation,

        teamProfessionalIds: validTeamIds,
      });

      router.push('/pts/proposals?updated=1');
    } catch (error: unknown) {
      if (error instanceof PtsProposalApiError && error.statusCode === 401) {
        router.replace('/login');

        return;
      }

      if (error instanceof PtsProposalApiError) {
        setSubmitError(error.message);

        return;
      }

      setSubmitError('Não foi possível atualizar a proposta de PTS');
    } finally {
      setIsSaving(false);
    }
  }

  const heading = (
    <div className="heading">
      <div>
        <h1>Editar proposta de PTS</h1>
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

  if (loadStatus === 'error' || !proposal) {
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
      <dl className="ux-summary">
        <div>
          <dt>Paciente</dt>
          <dd>{proposal.patient.name}</dd>
        </div>
      </dl>
    );
  } else if (step === 1) {
    body = (
      <div className="form-grid">
        <div className="field full">
          <span className="ux-labeltip">
            <label className="field-label" htmlFor="edit-social-situation">
              Situação social
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <HelpTooltip id="edit-social-tip" label="Situação social">
              Moradia, rotina da família, rede de apoio e acesso a serviços.
              Nunca aparece ao paciente.
            </HelpTooltip>
          </span>
          <textarea
            className="input"
            id="edit-social-situation"
            name="socialSituation"
            rows={4}
            aria-required="true"
            value={socialSituation}
            disabled={isSaving}
            placeholder="Ex.: mora com a mãe e a avó; a mãe trabalha à tarde"
            aria-invalid={Boolean(socialError)}
            aria-describedby={
              socialError
                ? 'edit-social-tip edit-social-error'
                : 'edit-social-tip'
            }
            onChange={(event) => {
              setSocialSituation(event.target.value);

              if (socialError) {
                setSocialError('');
              }
            }}
          />
          {socialError ? (
            <p id="edit-social-error" className={ui.fieldError}>
              {socialError}
            </p>
          ) : null}
        </div>
      </div>
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

      <form onSubmit={handleSubmit} noValidate>
        <section className="ux-formcard ux-wz-step" aria-labelledby="wz-title">
          <div className="ux-wz-head">
            <WizardSteps current={step} />
            <div>
              <h2 id="wz-title">{PTS_STEPS[step]}</h2>
            </div>
          </div>

          <div className="ux-wz-body">{body}</div>

          <div className="ux-formcard-foot ux-wz-foot">
            {step > 0 ? (
              <button
                type="button"
                className="btn"
                disabled={isSaving}
                onClick={() => setStep((step - 1) as PtsStep)}
              >
                <Icon name="chevronLeft" className="icon-sm" />
                Voltar
              </button>
            ) : (
              <span />
            )}

            {step < 2 ? (
              <button type="submit" className="btn btn-primary">
                Próximo
                <Icon name="chevronRight" className="icon-sm" />
              </button>
            ) : (
              <button
                type="submit"
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
      </form>
    </>
  );
}
