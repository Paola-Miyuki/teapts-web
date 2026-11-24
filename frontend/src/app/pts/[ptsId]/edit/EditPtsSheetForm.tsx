'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getPts, updatePtsSheet, type PtsDetail } from '@/lib/pts';

// Passos de editar-pts.html.
const STEPS = ['Diagnóstico', 'Perfil e vulnerabilidades', 'Prazo'] as const;

type Step = 0 | 1 | 2;
type LoadStatus = 'loading' | 'ready' | 'error';

type FormState = {
  caseStudyDate: string;
  supportLevel: string;
  cid: string;
  diagnosisSummary: string;
  strengths: string;
  priorityNeeds: string[];
  comorbidities: string;
  sensoryProfile: string;
  communicationMethod: string;
  vulnerabilities: string;
  socialSituation: string;
  nextReviewAt: string;
};

type FieldErrors = Partial<
  Record<
    'caseStudyDate' | 'diagnosisSummary' | 'socialSituation' | 'nextReviewAt',
    string
  >
>;

const LOAD_ERROR = 'Não foi possível carregar os dados do PTS.';
const SAVE_ERROR = 'Não foi possível atualizar o PTS.';

function toForm(pts: PtsDetail): FormState {
  return {
    caseStudyDate: pts.caseStudyDate ?? '',
    supportLevel: pts.supportLevel ? String(pts.supportLevel) : '',
    cid: pts.cid ?? '',
    diagnosisSummary: pts.diagnosisSummary ?? '',
    strengths: pts.strengths ?? '',
    priorityNeeds: pts.priorityNeeds ?? [],
    comorbidities: pts.comorbidities ?? '',
    sensoryProfile: pts.sensoryProfile ?? '',
    communicationMethod: pts.communicationMethod ?? '',
    vulnerabilities: pts.vulnerabilities ?? '',
    socialSituation: pts.socialSituation ?? '',
    nextReviewAt: pts.nextReviewAt ?? '',
  };
}

function Field({
  id,
  label,
  tip,
  required = false,
  error,
  full = true,
  children,
}: {
  id: string;
  label: string;
  tip?: string;
  required?: boolean;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'field full' : 'field'}>
      <span className="ux-labeltip">
        <label className="field-label" htmlFor={id}>
          {label}
          {required && (
            <span className="ux-req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {tip && (
          <HelpTooltip id={`${id}-tip`} label={label}>
            {tip}
          </HelpTooltip>
        )}
      </span>
      {children}
      {error ? (
        <p id={`${id}-error`} className={ui.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Tela "Editar PTS" (RFPTS005): a ficha do PTS ativo em 3 passos.
export default function EditPtsSheetForm({
  ptsId,
  account,
}: {
  ptsId: string;
  account: Account;
}) {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [pts, setPts] = useState<PtsDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [newNeed, setNewNeed] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    getPts(ptsId, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) {
          return;
        }

        if (!['planning', 'running'].includes(loaded.status)) {
          setLoadError(
            'Somente o PTS em planejamento ou execução pode ser editado.',
          );
          setLoadStatus('error');
          return;
        }

        const allowed = can(account, 'editPts', {
          pts: {
            status: loaded.status,
            responsibleProfessionalId: loaded.responsible.id,
            teamProfessionalIds: loaded.team.map((member) => member.id),
          },
        });

        if (!allowed) {
          setLoadError(
            'Somente a equipe do PTS e o administrador podem editar a ficha.',
          );
          setLoadStatus('error');
          return;
        }

        setPts(loaded);
        setForm(toForm(loaded));
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

  useEffect(() => {
    if (submitError) {
      errorRef.current?.focus();
    }
  }, [submitError]);

  function handleRetry() {
    setLoadStatus('loading');
    setLoadError('');
    setReloadKey((current) => current + 1);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function addNeed() {
    const need = newNeed.trim();

    if (!need || !form) {
      return;
    }

    update('priorityNeeds', [...form.priorityNeeds, need]);
    setNewNeed('');
  }

  function moveNeedUp(index: number) {
    if (!form || index === 0) {
      return;
    }

    const needs = [...form.priorityNeeds];
    [needs[index - 1], needs[index]] = [needs[index], needs[index - 1]];
    update('priorityNeeds', needs);
  }

  function validate(current: Step, values: FormState): FieldErrors {
    const found: FieldErrors = {};

    if (current === 0) {
      if (!values.caseStudyDate) {
        found.caseStudyDate = 'Informe a data do estudo de caso.';
      }

      if (!values.diagnosisSummary.trim()) {
        found.diagnosisSummary = 'Descreva a síntese do diagnóstico.';
      }
    }

    if (current === 1 && !values.socialSituation.trim()) {
      found.socialSituation = 'Descreva a situação social do paciente.';
    }

    if (current === 2 && !values.nextReviewAt) {
      found.nextReviewAt = 'Informe a próxima revisão.';
    }

    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || !pts || !form) {
      return;
    }

    setSubmitError('');

    const found = validate(step, form);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      const firstId = {
        caseStudyDate: 'sheet-study',
        diagnosisSummary: 'sheet-summary',
        socialSituation: 'sheet-social',
        nextReviewAt: 'sheet-review',
      }[Object.keys(found)[0] as keyof FieldErrors];
      document.getElementById(firstId)?.focus();
      return;
    }

    if (step < 2) {
      setStep((step + 1) as Step);
      return;
    }

    setIsSaving(true);

    try {
      await updatePtsSheet(pts.id, {
        caseStudyDate: form.caseStudyDate,
        diagnosisSummary: form.diagnosisSummary.trim(),
        cid: form.cid.trim() || null,
        supportLevel: form.supportLevel ? Number(form.supportLevel) : null,
        strengths: form.strengths.trim() || null,
        priorityNeeds: form.priorityNeeds,
        socialSituation: form.socialSituation.trim(),
        vulnerabilities: form.vulnerabilities.trim() || null,
        comorbidities: form.comorbidities.trim() || null,
        sensoryProfile: form.sensoryProfile.trim() || null,
        communicationMethod: form.communicationMethod.trim() || null,
        nextReviewAt: form.nextReviewAt,
      });

      router.push(`/pts/${pts.id}`);
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace('/login');
        return;
      }

      // 403 e 409 mostram a mensagem da API.
      setSubmitError(
        reason instanceof ApiError && reason.apiMessage
          ? reason.apiMessage
          : SAVE_ERROR,
      );
    } finally {
      setIsSaving(false);
    }
  }

  const heading = (
    <div className="heading">
      <div>
        <h1>{pts ? `Editar PTS de ${pts.patient.name}` : 'Editar PTS'}</h1>
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

  if (loadStatus === 'error' || !pts || !form) {
    return (
      <>
        {heading}
        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível editar o PTS</h2>
          <p>{loadError || LOAD_ERROR}</p>
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
      <div className="form-grid">
        <Field
          id="sheet-study"
          label="Data do estudo de caso"
          required
          full={false}
          error={errors.caseStudyDate}
          tip="Dia da reunião em que a equipe juntou as avaliações de cada especialidade e decidiu o diagnóstico."
        >
          <input
            className="input"
            id="sheet-study"
            type="date"
            aria-required="true"
            value={form.caseStudyDate}
            disabled={isSaving}
            aria-invalid={Boolean(errors.caseStudyDate)}
            onChange={(event) => update('caseStudyDate', event.target.value)}
          />
        </Field>

        <Field
          id="sheet-level"
          label="Nível de suporte"
          full={false}
          tip="Nível do DSM-5-TR: 1 (exige apoio), 2 (exige apoio substancial) ou 3 (exige apoio muito substancial)."
        >
          <select
            className="select"
            id="sheet-level"
            value={form.supportLevel}
            disabled={isSaving}
            onChange={(event) => update('supportLevel', event.target.value)}
          >
            <option value="">Selecione</option>
            <option value="1">Nível 1</option>
            <option value="2">Nível 2</option>
            <option value="3">Nível 3</option>
          </select>
        </Field>

        <Field
          id="sheet-cid"
          label="CID"
          tip="Código da CID-10 do diagnóstico."
        >
          <input
            className="input"
            id="sheet-cid"
            type="text"
            placeholder="Ex.: F84.0"
            value={form.cid}
            disabled={isSaving}
            onChange={(event) => update('cid', event.target.value)}
          />
        </Field>

        <Field
          id="sheet-summary"
          label="Síntese do diagnóstico"
          required
          error={errors.diagnosisSummary}
          tip="O que a equipe concluiu no estudo de caso: como o paciente está hoje e o que mais pesa no cuidado."
        >
          <textarea
            className="input"
            id="sheet-summary"
            rows={5}
            aria-required="true"
            value={form.diagnosisSummary}
            disabled={isSaving}
            aria-invalid={Boolean(errors.diagnosisSummary)}
            onChange={(event) => update('diagnosisSummary', event.target.value)}
          />
        </Field>

        <Field
          id="sheet-strengths"
          label="Potencialidades"
          tip="O que o paciente já faz bem e pode apoiar o plano."
        >
          <textarea
            className="input"
            id="sheet-strengths"
            rows={2}
            value={form.strengths}
            disabled={isSaving}
            onChange={(event) => update('strengths', event.target.value)}
          />
        </Field>

        <div className="field full">
          <span className="ux-labeltip">
            <span className="field-label">
              Necessidades prioritárias{' '}
              <span className="muted">(em ordem)</span>
            </span>
            <HelpTooltip id="sheet-needs-tip" label="Necessidades prioritárias">
              O que o plano precisa trabalhar, da mais para a menos urgente. As
              metas saem daqui.
            </HelpTooltip>
          </span>

          {form.priorityNeeds.length > 0 && (
            <ol className="ux-needs">
              {form.priorityNeeds.map((need, index) => (
                <li key={`${index}-${need}`}>
                  <span className="ux-need-n">{index + 1}</span>
                  <span className="grow">{need}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Subir ${need}`}
                    disabled={isSaving || index === 0}
                    onClick={() => moveNeedUp(index)}
                  >
                    <Icon name="up" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remover ${need}`}
                    disabled={isSaving}
                    onClick={() =>
                      update(
                        'priorityNeeds',
                        form.priorityNeeds.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="ux-inline">
            <input
              className="input"
              aria-label="Nova necessidade"
              placeholder="Ex.: Autonomia na rotina escolar"
              value={newNeed}
              disabled={isSaving}
              onChange={(event) => setNewNeed(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addNeed();
                }
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={isSaving}
              onClick={addNeed}
            >
              <Icon name="plus" />
              Adicionar
            </button>
          </div>
        </div>
      </div>
    );
  } else if (step === 1) {
    body = (
      <>
        <section className="ux-fsection">
          <header>
            <h3>Perfil de neurodivergência</h3>
          </header>
          <div>
            <div className="form-grid">
              <Field
                id="sheet-comorb"
                label="Comorbidades"
                tip="Outras condições de saúde que acompanham o TEA."
              >
                <input
                  className="input"
                  id="sheet-comorb"
                  type="text"
                  placeholder="Ex.: epilepsia, TDAH"
                  value={form.comorbidities}
                  disabled={isSaving}
                  onChange={(event) =>
                    update('comorbidities', event.target.value)
                  }
                />
              </Field>

              <Field id="sheet-sensory" label="Perfil sensorial">
                <textarea
                  className="input"
                  id="sheet-sensory"
                  rows={3}
                  value={form.sensoryProfile}
                  disabled={isSaving}
                  onChange={(event) =>
                    update('sensoryProfile', event.target.value)
                  }
                />
              </Field>

              <Field id="sheet-comm" label="Método de comunicação">
                <input
                  className="input"
                  id="sheet-comm"
                  type="text"
                  placeholder="Ex.: verbal, verbal com ecolalia, CAA"
                  value={form.communicationMethod}
                  disabled={isSaving}
                  onChange={(event) =>
                    update('communicationMethod', event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="ux-fsection">
          <header>
            <h3>Vulnerabilidades e situação social</h3>
          </header>
          <div>
            <div className="form-grid">
              <Field
                id="sheet-vuln"
                label="Vulnerabilidades e fatores de risco"
              >
                <textarea
                  className="input"
                  id="sheet-vuln"
                  rows={3}
                  value={form.vulnerabilities}
                  disabled={isSaving}
                  onChange={(event) =>
                    update('vulnerabilities', event.target.value)
                  }
                />
              </Field>

              <Field
                id="sheet-social"
                label="Situação social"
                required
                error={errors.socialSituation}
                tip="Moradia, rotina da família, rede de apoio e acesso a serviços. Nunca aparece ao paciente."
              >
                <textarea
                  className="input"
                  id="sheet-social"
                  rows={4}
                  aria-required="true"
                  value={form.socialSituation}
                  disabled={isSaving}
                  aria-invalid={Boolean(errors.socialSituation)}
                  onChange={(event) =>
                    update('socialSituation', event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </section>
      </>
    );
  } else {
    body = (
      <div className="form-grid">
        <Field
          id="sheet-created"
          label="Elaborado em"
          full={false}
          tip="Data em que o PTS foi criado."
        >
          <input
            className="input"
            id="sheet-created"
            type="text"
            readOnly
            value={
              pts.createdAt
                ? new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(pts.createdAt))
                : ''
            }
          />
        </Field>

        <Field
          id="sheet-review"
          label="Próxima revisão (data máxima)"
          required
          full={false}
          error={errors.nextReviewAt}
          tip="Data limite do ciclo: nenhuma meta pode passar dela."
        >
          <input
            className="input"
            id="sheet-review"
            type="date"
            aria-required="true"
            value={form.nextReviewAt}
            disabled={isSaving}
            aria-invalid={Boolean(errors.nextReviewAt)}
            onChange={(event) => update('nextReviewAt', event.target.value)}
          />
        </Field>
      </div>
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
        <section
          className="ux-formcard ux-wz-step"
          aria-labelledby="sheet-title"
        >
          <div className="ux-wz-head">
            <ol
              className="ux-steps ux-steps-3"
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
              <h2 id="sheet-title">{STEPS[step]}</h2>
            </div>
          </div>

          <div className="ux-wz-body">{body}</div>

          <div className="ux-formcard-foot ux-wz-foot">
            {step > 0 ? (
              <button
                type="button"
                className="btn"
                disabled={isSaving}
                onClick={() => setStep((step - 1) as Step)}
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
                {isSaving ? 'Salvando...' : 'Salvar PTS'}
              </button>
            )}
          </div>
        </section>
      </form>
    </>
  );
}
