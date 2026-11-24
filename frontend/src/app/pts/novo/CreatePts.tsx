'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import TeamMembers from '@/components/pts/TeamMembers';
import WizardSteps, {
  PTS_STEPS,
  type PtsStep,
} from '@/components/pts/WizardSteps';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { initSuperTokens } from '@/lib/supertokens';
import { createPts, listProfessionals } from './api/ptsApi';
import { mapCreatePtsError, type CreatePtsError } from './errors';
import { ErrorMessage, PatientSelect } from './_components';
import type { EligiblePatient, Professional, Pts } from './types';

type LoadStatus = 'loading' | 'ready' | 'error';

type Step = PtsStep;

interface FieldErrors {
  patient?: string;
  social?: string;
  professional?: string;
}

type CreatePtsProps = {
  account?: Account;
};

function Required() {
  return (
    <span className="ux-req" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className={ui.fieldError}>
      {message}
    </p>
  ) : null;
}

function professionalLabel(professional: Professional) {
  return `${professional.name} · ${professional.specialism.name}`;
}

export function CreatePts({ account }: CreatePtsProps) {
  useEffect(() => {
    initSuperTokens();
  }, []);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [step, setStep] = useState<Step>(0);
  const [responsibleId, setResponsibleId] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [patient, setPatient] = useState<EligiblePatient | null>(null);
  const [social, setSocial] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<CreatePtsError | null>(null);
  const [created, setCreated] = useState<Pts | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);
  const isAdmin = account?.role === 'admin';
  const accountProfileIds = account?.professionalProfileIds ?? [];

  useEffect(() => {
    const controller = new AbortController();

    listProfessionals(controller.signal)
      .then((loadedProfessionals) => {
        const own = loadedProfessionals.filter((professional) =>
          accountProfileIds.includes(professional.id),
        );

        setProfessionals(loadedProfessionals);
        // O admin (RN022) não tem perfil: escolhe o responsável.
        setResponsibleId(!isAdmin && own.length === 1 ? own[0].id : '');
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadStatus('error');
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.role, accountProfileIds.join(','), reloadKey]);

  useEffect(() => {
    if (submitError) {
      errorRef.current?.focus();
    }
  }, [submitError]);

  const ownProfessionals = professionals.filter((professional) =>
    accountProfileIds.includes(professional.id),
  );
  const responsible =
    professionals.find((professional) => professional.id === responsibleId) ??
    null;
  const hasNoProfessionalProfile =
    loadStatus === 'ready' &&
    !!account &&
    !isAdmin &&
    ownProfessionals.length === 0;
  const teamOptions = professionals.filter(
    (professional) => professional.id !== responsibleId,
  );

  function goTo(next: Step) {
    if (next > step) {
      const errors: FieldErrors = {};

      if (step === 0 && !patient) errors.patient = 'Selecione o paciente';
      if (step === 1 && !social.trim()) {
        errors.social = 'Descreva a situação social do paciente';
      }

      setFieldErrors(errors);

      if (errors.patient || errors.social) {
        document.getElementById(errors.patient ? 'patient' : 'social')?.focus();
        return;
      }
    }

    setStep(next);
  }

  function reset() {
    setCreated(null);
    setStep(0);
    setPatient(null);
    setSocial('');
    setTeamIds([]);
    setFieldErrors({});
    setSubmitError(null);
    setLoadStatus('loading');
    setReloadKey((key) => key + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < 2) {
      goTo((step + 1) as Step);
      return;
    }

    if (isLoading || !patient) {
      return;
    }

    if (!responsible) {
      setFieldErrors({ professional: 'Selecione o profissional responsável' });
      document.getElementById('professional')?.focus();
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsLoading(true);

    try {
      const pts = await createPts({
        professionalId: responsible.id,
        patientId: patient.id,
        socialSituation: social.trim(),
        teamProfessionalIds: teamIds.filter((id) => id !== responsible.id),
      });

      setCreated({
        ...pts,
        patient: pts?.patient ?? patient,
        team: pts?.team ?? [],
      } as Pts);
    } catch (error) {
      const mapped = mapCreatePtsError(error);

      setSubmitError(mapped);

      if (mapped.kind === 'active-exists') {
        setFieldErrors({ patient: mapped.message });
        setStep(0);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (created) {
    const teamLength = created.team?.length ?? 0;

    return (
      <>
        <div className="heading">
          <div>
            <h1>Proposta criada</h1>
          </div>
        </div>

        <section
          className="ux-card ux-empty-card"
          role="status"
          data-testid="pts-created"
        >
          <p>
            A proposta para <strong>{created.patient.name}</strong> foi criada e
            aguarda a aprovação do paciente
            {teamLength > 0
              ? `, com ${teamLength} ${
                  teamLength === 1 ? 'profissional' : 'profissionais'
                } na equipe inicial`
              : ''}
            .
          </p>
          <div className="ux-inline">
            <Link href="/pts/proposals" className="btn btn-primary">
              Ver propostas
            </Link>
            <button type="button" className="btn" onClick={reset}>
              Criar outra proposta
            </button>
          </div>
        </section>
      </>
    );
  }

  let body: ReactNode;

  if (step === 0) {
    body = (
      <div className="field">
        <label className="field-label" htmlFor="patient">
          Paciente
          <Required />
        </label>
        <PatientSelect
          id="patient"
          value={patient}
          onChange={(selected) => {
            setPatient(selected);

            if (selected) {
              setFieldErrors((fields) => ({ ...fields, patient: undefined }));

              if (submitError?.kind === 'active-exists') {
                setSubmitError(null);
              }
            }
          }}
          disabled={isLoading || loadStatus !== 'ready'}
          invalid={Boolean(fieldErrors.patient)}
          describedBy={fieldErrors.patient ? 'patient-error' : undefined}
        />
        <FieldError id="patient-error" message={fieldErrors.patient} />
      </div>
    );
  } else if (step === 1) {
    body = (
      <div className="form-grid">
        <div className="field full">
          <span className="ux-labeltip">
            <label className="field-label" htmlFor="social">
              Situação social
              <Required />
            </label>
            <HelpTooltip id="social-tip" label="Situação social">
              Moradia, rotina da família, rede de apoio e acesso a serviços.
              Nunca aparece ao paciente.
            </HelpTooltip>
          </span>
          <textarea
            className="input"
            id="social"
            rows={4}
            placeholder="Ex.: mora com a mãe e a avó; a mãe trabalha à tarde"
            value={social}
            disabled={isLoading}
            aria-required="true"
            aria-invalid={fieldErrors.social ? 'true' : 'false'}
            aria-describedby={
              fieldErrors.social ? 'social-tip social-error' : 'social-tip'
            }
            onChange={(event) => {
              setSocial(event.target.value);
              setFieldErrors((fields) => ({ ...fields, social: undefined }));
            }}
          />
          <FieldError id="social-error" message={fieldErrors.social} />
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
            <div className="form-grid">
              <div className="field full">
                <label className="field-label" htmlFor="professional">
                  Profissional responsável
                </label>
                {isAdmin ? (
                  <select
                    className="select"
                    id="professional"
                    value={responsibleId}
                    disabled={isLoading}
                    aria-invalid={fieldErrors.professional ? 'true' : 'false'}
                    onChange={(event) => {
                      setResponsibleId(event.target.value);
                      setTeamIds((ids) =>
                        ids.filter((id) => id !== event.target.value),
                      );
                    }}
                  >
                    <option value="">Selecione</option>
                    {professionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professionalLabel(professional)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    id="professional"
                    type="text"
                    readOnly
                    value={responsible ? professionalLabel(responsible) : ''}
                  />
                )}
                <FieldError
                  id="professional-error"
                  message={fieldErrors.professional}
                />
              </div>
            </div>
          </div>
        </section>

        <TeamMembers
          professionals={teamOptions}
          selectedIds={teamIds}
          onChange={setTeamIds}
          disabled={isLoading}
          addOnSelect
        />
      </>
    );
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>Criar proposta de PTS</h1>
        </div>
        <div className="heading-actions">
          <Link className="btn" href="/pts/proposals">
            Cancelar
          </Link>
        </div>
      </div>

      {loadStatus === 'error' && (
        <ErrorMessage
          title="Não foi possível carregar os dados"
          message="Verifique sua conexão e tente novamente"
          onRetry={() => {
            setLoadStatus('loading');
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {hasNoProfessionalProfile && (
        <ErrorMessage
          title="Sem perfil profissional"
          message="Esta conta não possui perfil profissional. Procure o administrador para cadastrar um"
        />
      )}

      {submitError && (
        <ErrorMessage
          ref={errorRef}
          title={submitError.title}
          message={submitError.message}
        />
      )}

      <form onSubmit={handleSubmit} noValidate data-form="pts">
        <section
          className="ux-formcard ux-wz-step"
          aria-labelledby="wz-title"
          aria-busy={loadStatus === 'loading'}
        >
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
                disabled={isLoading}
                onClick={() => goTo((step - 1) as Step)}
              >
                <Icon name="chevronLeft" className="icon-sm" />
                Voltar
              </button>
            ) : (
              <span />
            )}

            {step < 2 ? (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loadStatus !== 'ready' || hasNoProfessionalProfile}
              >
                Próximo
                <Icon name="chevronRight" className="icon-sm" />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || hasNoProfessionalProfile}
              >
                <Icon name="check" className="icon-sm" />
                {isLoading ? 'Criando proposta...' : 'Criar proposta'}
              </button>
            )}
          </div>
        </section>
      </form>
    </>
  );
}

export default CreatePts;
