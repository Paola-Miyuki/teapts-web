'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ui from '@/components/ui.module.css';
import Icon from '@/components/Icon';
import { initSuperTokens } from '@/lib/supertokens';
import type { Account } from '@/lib/account';
import {
  createPts,
  listEligiblePatients,
  listProfessionals,
} from './api/ptsApi';
import { mapCreatePtsError, type CreatePtsError } from './errors';
import {
  ErrorMessage,
  LoadingState,
  PatientSelect,
  ProfessionalTeamSelect,
  SocialSituationInput,
  SubmitButton,
} from './_components';
import styles from './novo.module.css';
import {
  inputCls,
  labelCls,
  helpCls,
  fieldCls,
  primaryBtnCls,
  secondaryBtnCls,
} from './styles';
import type { Patient, Professional, Pts } from './types';

type LoadStatus = 'loading' | 'ready' | 'error';

interface FieldErrors {
  patient?: string;
  social?: string;
}

type CreatePtsProps = {
  account?: Account;
};

function validate(patientId: string, social: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!patientId) {
    errors.patient = 'Selecione o paciente.';
  }

  if (!social.trim()) {
    errors.social = 'Descreva a situação social do paciente.';
  }

  return errors;
}

export function CreatePts({ account }: CreatePtsProps) {
  useEffect(() => {
    initSuperTokens();
  }, []);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [responsibleId, setResponsibleId] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [patientId, setPatientId] = useState('');
  const [social, setSocial] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<CreatePtsError | null>(null);
  const [created, setCreated] = useState<Pts | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      listEligiblePatients(controller.signal),
      listProfessionals(controller.signal),
    ])
      .then(([rawPatients, rawProfessionals]) => {
        const loadedPatients: Patient[] = Array.isArray(rawPatients)
          ? rawPatients
          : ((rawPatients as { data?: Patient[] })?.data ?? []);

        const loadedProfessionals: Professional[] = Array.isArray(
          rawProfessionals,
        )
          ? rawProfessionals
          : ((rawProfessionals as { data?: Professional[] })?.data ?? []);

        const accountProfileIds = account?.professionalProfileIds ?? [];

        const ownProfessionals = loadedProfessionals.filter((professional) =>
          accountProfileIds.includes(professional.id),
        );

        setPatients(loadedPatients);
        setProfessionals(loadedProfessionals);

        setResponsibleId(
          ownProfessionals.length === 1 ? ownProfessionals[0].id : '',
        );

        setLoadStatus('ready');
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('ERRO AO CARREGAR DADOS NO CREATE_PTS:', error);
          setLoadStatus('error');
        }
      });

    return () => controller.abort();
  }, [account?.professionalProfileIds, reloadKey]);

  useEffect(() => {
    if (submitError) {
      errorRef.current?.focus();
    }
  }, [submitError]);

  const accountProfileIds = account?.professionalProfileIds ?? [];

  const accountProfessionals = professionals.filter((professional) =>
    accountProfileIds.includes(professional.id),
  );

  const me =
    accountProfessionals.length === 1
      ? accountProfessionals[0]
      : (accountProfessionals.find(
          (professional) => professional.id === responsibleId,
        ) ?? null);

  const hasNoProfessionalProfile =
    loadStatus === 'ready' && !!account && accountProfessionals.length === 0;

  const teamOptions = professionals.filter(
    (professional) => professional.id !== me?.id,
  );

  const toggleTeamMember = (id: string) => {
    setTeamIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  };

  function reset() {
    setCreated(null);
    setPatientId('');
    setSocial('');
    setTeamIds([]);
    setFieldErrors({});
    setSubmitError(null);
    setResponsibleId(
      accountProfessionals.length === 1 ? accountProfessionals[0].id : '',
    );
    setLoadStatus('loading');
    setReloadKey((key) => key + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading || !me) {
      return;
    }

    const errors = validate(patientId, social);

    setFieldErrors(errors);
    setSubmitError(null);

    if (errors.patient || errors.social) {
      document.getElementById(errors.patient ? 'patient' : 'social')?.focus();
      return;
    }

    setIsLoading(true);

    try {
      const selectedPatient = patients.find((p) => p.id === patientId);

      const pts = await createPts({
        professionalId: me.id,
        patientId,
        socialSituation: social.trim(),
        teamProfessionalIds: teamIds,
      });

      setCreated({
        ...pts,
        patient: pts?.patient ?? {
          id: patientId,
          name: selectedPatient?.name ?? 'paciente',
        },
        team: pts?.team ?? [],
      } as Pts);
    } catch (error) {
      console.error('ERRO AO CRIAR PROPOSTA DE PTS:', error);
      const mapped = mapCreatePtsError(error);

      setSubmitError(mapped);

      if (mapped.kind === 'active-exists') {
        setFieldErrors({ patient: mapped.message });
      }
    } finally {
      setIsLoading(false);
    }
  }

  const patientName = created?.patient?.name ?? 'paciente';
  const teamLength = created?.team?.length ?? 0;

  return (
    <>
      <div className={ui.heading}>
        <p className={ui.eyebrow}>Programa Terapêutico Singular</p>

        <h1>{created ? 'Proposta criada' : 'Criar proposta de PTS'}</h1>

        {!created && (
          <p>
            Defina o paciente e a equipe para começar um plano de cuidado
            compartilhado.
          </p>
        )}
      </div>

      <div className={styles.layout}>
        {created ? (
          <div
            role="status"
            data-testid="pts-created"
            className={`${ui.empty} ${styles.successContainer}`}
          >
            <p>
              A proposta para <strong>{patientName}</strong> foi criada e
              aguarda a aprovação do paciente
              {teamLength > 0
                ? `, com ${teamLength} ${
                    teamLength === 1 ? 'profissional' : 'profissionais'
                  } na equipe inicial`
                : ''}
              .
            </p>

            <div className={styles.actions}>
              <Link
                href={`/pts/proposals?patientId=${created.patient.id}`}
                className={primaryBtnCls}
              >
                Ver propostas do paciente
              </Link>

              <button type="button" onClick={reset} className={secondaryBtnCls}>
                Criar outra proposta
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            data-form="pts"
            className={`${ui.card} ${styles.form}`}
          >
            <div className={styles.steps}>
              <span className={`${styles.step} ${styles.stepActive}`}>
                <span className={styles.stepNumber}>1</span>
                Elaborar proposta
              </span>

              <span aria-hidden="true" className={styles.stepSeparator}>
                —
              </span>

              <span className={styles.step}>
                <span className={styles.stepNumber}>2</span>
                Aprovação do paciente
              </span>
            </div>

            {submitError && (
              <ErrorMessage
                ref={errorRef}
                title={submitError.title}
                message={submitError.message}
              />
            )}

            <div className={fieldCls}>
              <label htmlFor="professional" className={labelCls}>
                Seu perfil profissional
              </label>

              {accountProfessionals.length === 1 ? (
                <input
                  id="professional"
                  type="text"
                  readOnly
                  value={`${accountProfessionals[0]?.name ?? ''} ${
                    accountProfessionals[0]?.specialism?.name
                      ? `· ${accountProfessionals[0].specialism.name}`
                      : ''
                  }`}
                  aria-describedby="professional-help"
                  className={`${inputCls(false)} ${styles.readonly}`}
                />
              ) : (
                <div className={styles.selectWrap}>
                  <select
                    id="professional"
                    value={responsibleId}
                    onChange={(event) => setResponsibleId(event.target.value)}
                    required
                    disabled={isLoading || accountProfessionals.length === 0}
                    aria-describedby="professional-help"
                    className={`${inputCls(false)} ${styles.select}`}
                  >
                    <option value="">Selecione seu perfil profissional</option>

                    {accountProfessionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professional.name}{' '}
                        {professional.specialism?.name
                          ? `· ${professional.specialism.name}`
                          : ''}
                      </option>
                    ))}
                  </select>

                  <Icon name="chevronDown" className={styles.selectChevron} />
                </div>
              )}

              <p id="professional-help" className={helpCls}>
                Você será o profissional responsável por esta proposta.
              </p>
            </div>

            {loadStatus === 'loading' && (
              <LoadingState label="Carregando pacientes e profissionais..." />
            )}

            {loadStatus === 'error' && (
              <ErrorMessage
                title="Não foi possível carregar os dados"
                message="Verifique sua conexão e tente novamente."
                onRetry={() => {
                  setLoadStatus('loading');
                  setReloadKey((key) => key + 1);
                }}
              />
            )}

            {hasNoProfessionalProfile && (
              <ErrorMessage
                title="Sem perfil profissional"
                message="Esta conta não possui perfil profissional. Procure o administrador para cadastrar um."
              />
            )}

            {loadStatus === 'ready' && (
              <>
                <PatientSelect
                  patients={patients}
                  value={patientId}
                  disabled={isLoading}
                  error={fieldErrors.patient}
                  onChange={(value) => {
                    setPatientId(value);
                    setFieldErrors((fields) => ({
                      ...fields,
                      patient: undefined,
                    }));

                    if (submitError?.kind === 'active-exists') {
                      setSubmitError(null);
                    }
                  }}
                />

                <ProfessionalTeamSelect
                  professionals={teamOptions}
                  selectedIds={teamIds}
                  disabled={isLoading}
                  onToggle={toggleTeamMember}
                />

                <SocialSituationInput
                  value={social}
                  disabled={isLoading}
                  error={fieldErrors.social}
                  onChange={(value) => {
                    setSocial(value);
                    setFieldErrors((fields) => ({
                      ...fields,
                      social: undefined,
                    }));
                  }}
                />
              </>
            )}

            <div className={styles.actions}>
              <SubmitButton
                loading={isLoading}
                disabled={loadStatus !== 'ready' || !me}
              />

              <Link href="/home" className={secondaryBtnCls}>
                Cancelar
              </Link>
            </div>
          </form>
        )}

        {!created && (
          <aside className={styles.aside}>
            <h2>O primeiro passo é conjunto.</h2>

            <p>
              A proposta será apresentada ao paciente. Após a aprovação, o PTS
              entra em planejamento.
            </p>

            <p>
              Cada paciente pode ter apenas um PTS aprovado ativo. Outras
              propostas pendentes serão rejeitadas ao escolher uma equipe.
            </p>
          </aside>
        )}
      </div>
    </>
  );
}

export default CreatePts;
