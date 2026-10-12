'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { initSuperTokens } from '@/lib/supertokens';
import { createPts, getCurrentProfessional, listEligiblePatients, listProfessionals } from './api/ptsApi';
import { mapCreatePtsError, type CreatePtsError } from './errors';
import {
  ErrorMessage,
  LoadingState,
  PatientSelect,
  ProfessionalTeamSelect,
  SocialSituationInput,
  SubmitButton,
} from './components';
import { inputCls, labelCls, helpCls, fieldCls, primaryBtnCls, secondaryBtnCls } from './styles';
import type { Patient, Professional, Pts } from './types';

type LoadStatus = 'loading' | 'ready' | 'error';
interface FieldErrors {
  patient?: string;
  social?: string;
}

function validate(patientId: string, social: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!patientId) errors.patient = 'Selecione o paciente.';
  if (!social.trim()) errors.social = 'Descreva a situação social do paciente.';
  return errors;
}

export function CreatePts() {
  useEffect(() => {
    initSuperTokens();
  }, []);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [me, setMe] = useState<Professional | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [patientId, setPatientId] = useState('');
  const [social, setSocial] = useState('');
  const [teamIds, setTeamIds] = useState<number[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<CreatePtsError | null>(null);
  const [created, setCreated] = useState<Pts | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);

  // Carrega profissional logado, pacientes elegíveis e profissionais da equipe.
  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');
    Promise.all([
      getCurrentProfessional(controller.signal),
      listEligiblePatients(controller.signal),
      listProfessionals(controller.signal),
    ])
      .then(([current, p, pr]) => {
        setMe(current);
        setPatients(p);
        setProfessionals(pr);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus('error');
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const teamOptions = professionals.filter((p) => p.id !== me?.id);

  const toggleTeamMember = (id: number) =>
    setTeamIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  function reset() {
    setCreated(null);
    setPatientId('');
    setSocial('');
    setTeamIds([]);
    setFieldErrors({});
    setSubmitError(null);
    setReloadKey((k) => k + 1); // o paciente recém-criado deixa de ser elegível
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading || !me) return;

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
        patientId: Number(patientId),
        socialSituation: social.trim(),
        teamProfessionalIds: teamIds,
      });
      setCreated(pts);
    } catch (err) {
      const mapped = mapCreatePtsError(err);
      setSubmitError(mapped);
      if (mapped.kind === 'active-exists') setFieldErrors({ patient: mapped.message });
    } finally {
      setIsLoading(false);
    }
  }

  const createdPatient = created && patients.find((p) => p.id === created.patientId);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10 lg:py-12">
      <nav aria-label="Caminho da página" className="flex items-center gap-2 text-[12px] text-slate-500">
        <Link href="/pacientes" className="hover:text-slate-900">
          Início
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-700">Criar proposta de PTS</span>
      </nav>

      <header className="mt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Programa Terapêutico Singular</p>
        <h1 className="mt-4 font-serif text-[40px] font-normal leading-[1.1] tracking-tight text-slate-900 md:text-[46px]">
          Criar proposta de PTS
        </h1>
        <p className="mt-4 text-[14px] leading-6 text-slate-600">
          Defina o paciente e a equipe para começar um plano de cuidado compartilhado.
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
              <h2 className="font-serif text-[32px] font-normal leading-[1.15] text-slate-900">Proposta criada</h2>
              <p className="mt-4 text-[14px] leading-6 text-slate-600">
                <span className="mr-1.5 inline-flex rounded-full border border-[#ddddda] bg-[#fafaf9] px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  DRAFT
                </span>
                A proposta{createdPatient ? ` de ${createdPatient.name}` : ''} foi criada como DRAFT
                {created.teamProfessionalIds.length > 0
                  ? ` com ${created.teamProfessionalIds.length} ${
                      created.teamProfessionalIds.length === 1 ? 'profissional' : 'profissionais'
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
                <span className="grid h-6 w-6 place-items-center rounded-full border border-[#ddddda] text-[11px]">2</span>
                Aprovação do paciente
              </span>
            </div>

            {submitError && <ErrorMessage ref={errorRef} title={submitError.title} message={submitError.message} />}

            <div className={fieldCls}>
              <label htmlFor="professional" className={labelCls}>
                Seu perfil profissional
              </label>
              <input
                id="professional"
                type="text"
                readOnly
                value={me ? `${me.name} · ${me.specialty}` : ''}
                aria-describedby="professional-help"
                className={`${inputCls(false)} !bg-[#f5f5f4] text-slate-600`}
              />
              <p id="professional-help" className={helpCls}>
                Você será o profissional responsável por esta proposta.
              </p>
            </div>

            {loadStatus === 'loading' && <LoadingState label="Carregando pacientes e profissionais..." />}
            {loadStatus === 'error' && (
              <ErrorMessage
                title="Não foi possível carregar os dados"
                message="Verifique sua conexão e tente novamente."
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            )}

            {loadStatus === 'ready' && (
              <>
                <PatientSelect
                  patients={patients}
                  value={patientId}
                  disabled={isLoading}
                  error={fieldErrors.patient}
                  onChange={(v) => {
                    setPatientId(v);
                    setFieldErrors((f) => ({ ...f, patient: undefined }));
                    if (submitError?.kind === 'active-exists') setSubmitError(null);
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
                  onChange={(v) => {
                    setSocial(v);
                    setFieldErrors((f) => ({ ...f, social: undefined }));
                  }}
                />
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <SubmitButton loading={isLoading} disabled={loadStatus !== 'ready'} />
              <Link href="/pacientes" className={secondaryBtnCls}>
                Cancelar
              </Link>
            </div>
          </form>
        )}

        <aside className="border-t border-slate-900 pt-5">
          <h2 className="font-serif text-[24px] font-normal leading-[1.2] text-slate-900">O primeiro passo é conjunto.</h2>
          <p className="mt-4 text-[12px] leading-[22px] text-slate-500">
            A proposta será apresentada ao paciente. Após a aprovação, o PTS entra em planejamento.
          </p>
          <p className="mt-3 text-[12px] leading-[22px] text-slate-500">
            Cada paciente pode ter apenas um PTS aprovado ativo. Outras propostas pendentes serão rejeitadas ao escolher
            uma equipe.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default CreatePts;
