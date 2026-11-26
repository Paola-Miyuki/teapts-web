'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getPts, updatePtsSheet, type PtsDetail } from '@/lib/pts';

import {
  SheetDiagnosisFields,
  SheetProfileFields,
  toSheetForm,
  toSheetInput,
  type SheetErrors,
  type SheetForm,
} from '../../_components/SheetFields';

// Passos de editar-pts.html.
const STEPS = ['Diagnóstico', 'Perfil e vulnerabilidades', 'Prazo'] as const;

type Step = 0 | 1 | 2;
type LoadStatus = 'loading' | 'ready' | 'error';

const LOAD_ERROR = 'Não foi possível carregar os dados do PTS';
const SAVE_ERROR = 'Não foi possível atualizar o PTS';

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
  const [form, setForm] = useState<SheetForm | null>(null);
  const [errors, setErrors] = useState<SheetErrors>({});
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
            'Somente o PTS em planejamento ou execução pode ser editado',
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
            'Somente a equipe do PTS e o administrador podem editar a ficha',
          );
          setLoadStatus('error');
          return;
        }

        setPts(loaded);
        setForm(toSheetForm(loaded));
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

  function update<K extends keyof SheetForm>(key: K, value: SheetForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(current: Step, values: SheetForm): SheetErrors {
    const found: SheetErrors = {};

    if (current === 0) {
      if (!values.caseStudyDate) {
        found.caseStudyDate = 'Informe a data do estudo de caso';
      }

      if (!values.diagnosisSummary.trim()) {
        found.diagnosisSummary = 'Descreva a síntese do diagnóstico';
      }
    }

    if (current === 1 && !values.socialSituation.trim()) {
      found.socialSituation = 'Descreva a situação social do paciente';
    }

    if (current === 2 && !values.nextReviewAt) {
      found.nextReviewAt = 'Informe a próxima revisão';
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
      }[Object.keys(found)[0] as keyof SheetErrors];
      document.getElementById(firstId)?.focus();
      return;
    }

    if (step < 2) {
      setStep((step + 1) as Step);
      return;
    }

    setIsSaving(true);

    try {
      await updatePtsSheet(pts.id, toSheetInput(form));

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
        <FormField
          id="sheet-study"
          label="Data do estudo de caso"
          error={errors.caseStudyDate}
          help="Dia da reunião em que a equipe juntou as avaliações de cada especialidade e decidiu o diagnóstico."
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
        </FormField>

        <SheetDiagnosisFields
          form={form}
          errors={errors}
          disabled={isSaving}
          update={update}
        />
      </div>
    );
  } else if (step === 1) {
    body = (
      <>
        <SheetProfileFields
          form={form}
          errors={errors}
          disabled={isSaving}
          update={update}
        />
      </>
    );
  } else {
    body = (
      <div className="form-grid">
        <FormField
          id="sheet-created"
          label="Elaborado em"
          required={false}
          help="Data em que o PTS foi criado."
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
        </FormField>

        <FormField
          id="sheet-review"
          label="Próxima revisão (data máxima)"
          error={errors.nextReviewAt}
          help="Data limite do ciclo: nenhuma meta pode passar dela."
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
        </FormField>
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
