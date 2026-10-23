'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
} from './components';
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
  account: Account;
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
      .then(([loadedPatients, loadedProfessionals]) => {
        const accountProfessionals = loadedProfessionals.filter(
          (professional) =>
            account.professionalProfileIds.includes(professional.id),
        );

        if (accountProfessionals.length === 0) {
          throw new Error(
            'Nenhum perfil profissional da conta foi encontrado.',
          );
        }

        setPatients(loadedPatients);
        setProfessionals(loadedProfessionals);

        setResponsibleId(
          accountProfessionals.length === 1 ? accountProfessionals[0].id : '',
        );

        setLoadStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadStatus('error');
        }
      });

    return () => controller.abort();
  }, [account.professionalProfileIds, reloadKey]);

  useEffect(() => {
    if (submitError) {
      errorRef.current?.focus();
    }
  }, [submitError]);

  const accountProfessionals = professionals.filter((professional) =>
    account.professionalProfileIds.includes(professional.id),
  );

  const me =
    professionals.find((professional) => professional.id === responsibleId) ??
    null;

  const teamOptions = professionals.filter(
    (professional) => !account.professionalProfileIds.includes(professional.id),
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
      account.professionalProfileIds.length === 1
        ? account.professionalProfileIds[0]
        : '',
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
      const pts = await createPts({
        professionalId: me.id,
        patientId,
        socialSituation: social.trim(),
        teamProfessionalIds: teamIds,
      });

      setCreated(pts);
    } catch (error) {
      const mapped = mapCreatePtsError(error);

      setSubmitError(mapped);

      if (mapped.kind === 'active-exists') {
        setFieldErrors({ patient: mapped.message });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10 lg:py-12">
      <nav
        aria-label="Caminho da página"
        className="flex items-center gap-2 text-[12px] text-slate-500"
      >
        <Link href="/pacientes" className="hover:text-slate-900">
          Início
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-700">Criar proposta de PTS</span>
      </nav>

      <header className="mt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Programa Terapêutico Singular
        </p>

        <h1 className="mt-4 font-serif text-[40px] font-normal leading-[1.1] tracking-tight text-slate-900 md:text-[46px]">
          Criar proposta de PTS
        </h1>

        <p className="mt-4 text-[14px] leading-6 text-slate-600">
          Defina o paciente e a equipe para começar um plano de cuidado
          compartilhado.
        </p>
      </header>

      <div className="mt-10 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_390px]">
        {created ? (
          <div
            role="status"
            data-testid="pts-created"
            className="space-y-6 rounded-[20px] border border-[#e4e4e0] bg-white p-6 sm:p-[30px]"
          >
            <div>
              <h2 className="font-serif text-[32px] font-normal leading-[1.15] text-slate-900">
                Proposta criada
              </h2>

              <p className="mt-4 text-[14px] leading-6 text-slate-600">
                <span className="mr-1.5 inline-flex rounded-full border border-[#ddddda] bg-[#fafaf9] px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {created.status}
                </span>
                A proposta de {created.patient.name} foi criada como{' '}
                {created.status}
                {created.team.length > 0
                  ? ` com ${created.team.length} ${
                      created.team.length === 1
                        ? 'profissional'
                        : 'profissionais'
                    } na equipe inicial.`
                  : '.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/pts/${created.id}`} className={primaryBtnCls}>
                Abrir proposta
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
            className="space-y-6 rounded-[20px] border border-[#e4e4e0] bg-white p-6 sm:p-[30px]"
          >
            <div className="flex flex-wrap items-center gap-3 pb-1 text-[12px]">
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  1
                </span>
                Elaborar proposta
              </span>

              <span aria-hidden="true" className="text-slate-400">
                —
              </span>

              <span className="flex items-center gap-2 text-slate-500">
                <span className="grid h-6 w-6 place-items-center rounded-full border border-[#ddddda] text-[11px]">
                  2
                </span>
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
                  value={`${accountProfessionals[0].name} · ${accountProfessionals[0].specialism.name}`}
                  aria-describedby="professional-help"
                  className={`${inputCls(false)} !bg-[#f5f5f4] text-slate-600`}
                />
              ) : (
                <select
                  id="professional"
                  value={responsibleId}
                  onChange={(event) => setResponsibleId(event.target.value)}
                  required
                  disabled={isLoading}
                  aria-describedby="professional-help"
                  className={inputCls(false)}
                >
                  <option value="">Selecione seu perfil profissional</option>

                  {accountProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name} · {professional.specialism.name}
                    </option>
                  ))}
                </select>
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

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <SubmitButton
                loading={isLoading}
                disabled={
                  loadStatus !== 'ready' ||
                  !me ||
                  (accountProfessionals.length > 1 && !responsibleId)
                }
              />

              <Link href="/pacientes" className={secondaryBtnCls}>
                Cancelar
              </Link>
            </div>
          </form>
        )}

        <aside className="border-t border-slate-900 pt-5">
          <h2 className="font-serif text-[24px] font-normal leading-[1.2] text-slate-900">
            O primeiro passo é conjunto.
          </h2>

          <p className="mt-4 text-[12px] leading-[22px] text-slate-500">
            A proposta será apresentada ao paciente. Após a aprovação, o PTS
            entra em planejamento.
          </p>

          <p className="mt-3 text-[12px] leading-[22px] text-slate-500">
            Cada paciente pode ter apenas um PTS aprovado ativo. Outras
            propostas pendentes serão rejeitadas ao escolher uma equipe.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default CreatePts;
