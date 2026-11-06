'use client';

import { useEffect, useRef, useState } from 'react';

import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import ui from '@/components/ui.module.css';

import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';

import { initSuperTokens } from '@/lib/supertokens';

import TeamSelector from './_components/TeamSelector';

import {
  getProfessionalsForTeam,
  getPtsProposal,
  PtsProposalApiError,
  updatePtsProposal,
} from './api';

import styles from './edit.module.css';

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
            'Somente propostas aguardando decisão podem ser editadas.',
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
            'Somente o profissional responsável pode editar esta proposta.',
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
          setLoadError('Não foi possível carregar os dados da proposta.');
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

  function toggleTeamMember(professionalId: string) {
    setTeamIds((current) =>
      current.includes(professionalId)
        ? current.filter((id) => id !== professionalId)
        : [...current, professionalId],
    );
  }

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

    if (!trimmedSocialSituation) {
      setSocialError('Descreva a situação social do paciente.');

      document.getElementById('edit-social-situation')?.focus();

      return;
    }

    const validTeamIds = teamIds.filter(
      (professionalId) => professionalId !== proposal.responsible.id,
    );

    setIsSaving(true);

    try {
      const updatedProposal = await updatePtsProposal(proposal.id, {
        socialSituation: trimmedSocialSituation,

        teamProfessionalIds: validTeamIds,
      });

      const params = new URLSearchParams({
        patientId: updatedProposal.patient.id,

        updated: '1',
      });

      router.push(`/pts/proposals?${params.toString()}`);
    } catch (error: unknown) {
      if (error instanceof PtsProposalApiError && error.statusCode === 401) {
        router.replace('/login');

        return;
      }

      if (error instanceof PtsProposalApiError) {
        setSubmitError(error.message);

        return;
      }

      setSubmitError('Não foi possível atualizar a proposta de PTS.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loadStatus === 'loading') {
    return (
      <>
        <div className={ui.heading}>
          <p className={ui.eyebrow}>Programa Terapêutico Singular</p>

          <h1>Editar proposta de PTS</h1>

          <p>Atualize a situação social e a equipe inicial da proposta.</p>
        </div>

        <div className={`${ui.card} ${styles.stateCard}`} role="status">
          <span className={styles.spinner} aria-hidden="true" />

          <p>Carregando proposta...</p>
        </div>
      </>
    );
  }

  if (loadStatus === 'error' || !proposal) {
    return (
      <>
        <div className={ui.heading}>
          <p className={ui.eyebrow}>Programa Terapêutico Singular</p>

          <h1>Editar proposta de PTS</h1>
        </div>

        <div className={`${ui.card} ${styles.stateCard}`} role="alert">
          <h2>Não foi possível editar a proposta</h2>

          <p>{loadError || 'Não foi possível carregar a proposta.'}</p>

          <div className={styles.actions}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              onClick={handleRetry}
            >
              Tentar novamente
            </button>

            <Link
              href="/pts/proposals"
              className={`${ui.btn} ${ui.btnSecondary}`}
            >
              Voltar
            </Link>
          </div>
        </div>
      </>
    );
  }

  const backParams = new URLSearchParams({
    patientId: proposal.patient.id,
  });

  return (
    <>
      <div className={ui.heading}>
        <p className={ui.eyebrow}>Programa Terapêutico Singular</p>

        <h1>Editar proposta de PTS</h1>

        <p>Atualize a situação social e a composição inicial da equipe.</p>
      </div>

      <div className={styles.layout}>
        <form
          onSubmit={handleSubmit}
          noValidate
          className={`${ui.card} ${styles.form}`}
        >
          <div className={styles.steps}>
            <span className={`${styles.step} ${styles.stepActive}`}>
              <span className={styles.stepNumber}>1</span>
              Editar proposta
            </span>

            <span aria-hidden="true" className={styles.stepSeparator}>
              —
            </span>

            <span className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              Aprovação do paciente
            </span>
          </div>

          {submitError ? (
            <div ref={errorRef} tabIndex={-1} role="alert" className={ui.alert}>
              {submitError}
            </div>
          ) : null}

          <div className={ui.field}>
            <label htmlFor="edit-patient" className={ui.label}>
              Paciente
            </label>

            <input
              id="edit-patient"
              type="text"
              readOnly
              value={proposal.patient.name}
              className={`${ui.input} ${styles.readonly}`}
            />

            <p className={ui.hint}>
              O paciente não pode ser alterado nesta proposta.
            </p>
          </div>

          <div className={ui.field}>
            <label htmlFor="edit-responsible" className={ui.label}>
              Profissional responsável
            </label>

            <input
              id="edit-responsible"
              type="text"
              readOnly
              value={`${proposal.responsible.name} · ${proposal.responsible.specialism.name}`}
              className={`${ui.input} ${styles.readonly}`}
            />

            <p className={ui.hint}>
              O responsável pela proposta não pode ser alterado.
            </p>
          </div>

          <TeamSelector
            professionals={professionals}
            selectedIds={teamIds}
            disabled={isSaving}
            onToggle={toggleTeamMember}
          />

          <div className={ui.field}>
            <label htmlFor="edit-social-situation" className={ui.label}>
              Situação social
            </label>

            <textarea
              id="edit-social-situation"
              name="socialSituation"
              required
              value={socialSituation}
              disabled={isSaving}
              placeholder="Descreva a situação social do paciente"
              aria-invalid={Boolean(socialError)}
              aria-describedby={
                socialError
                  ? 'edit-social-help edit-social-error'
                  : 'edit-social-help'
              }
              className={`${ui.input} ${styles.textarea}`}
              onChange={(event) => {
                setSocialSituation(event.target.value);

                if (socialError) {
                  setSocialError('');
                }
              }}
            />

            <p id="edit-social-help" className={ui.hint}>
              Atualize as informações necessárias para a proposta.
            </p>

            {socialError ? (
              <p id="edit-social-error" className={ui.fieldError}>
                {socialError}
              </p>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className={`${ui.btn} ${ui.btnPrimary}`}
            >
              {isSaving ? 'Salvando...' : 'Salvar proposta'}
            </button>

            <Link
              href={`/pts/proposals?${backParams.toString()}`}
              className={`${ui.btn} ${ui.btnSecondary}`}
            >
              Cancelar
            </Link>
          </div>
        </form>

        <aside className={styles.aside}>
          <h2>Mantenha a proposta atualizada.</h2>

          <p>
            Antes da decisão do paciente, você pode atualizar a situação social
            e reorganizar a equipe inicial.
          </p>

          <p>
            Paciente e profissional responsável permanecem os mesmos durante a
            edição.
          </p>

          <p>
            Depois que a proposta for decidida, ela não poderá mais ser editada
            por este fluxo.
          </p>
        </aside>
      </div>
    </>
  );
}
