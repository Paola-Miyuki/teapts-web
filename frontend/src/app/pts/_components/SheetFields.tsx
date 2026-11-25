'use client';

import { useState } from 'react';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { PtsDetail, PtsSheetInput } from '@/lib/pts';

export type SheetForm = {
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

export type SheetErrors = Partial<
  Record<
    'caseStudyDate' | 'diagnosisSummary' | 'socialSituation' | 'nextReviewAt',
    string
  >
>;

export function toSheetForm(pts: PtsDetail): SheetForm {
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

// Corpo da API: textos aparados e opcional vazio como null.
export function toSheetInput(form: SheetForm): PtsSheetInput {
  return {
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
  };
}

type SheetFieldsProps = {
  form: SheetForm;
  errors: SheetErrors;
  disabled: boolean;
  update: <K extends keyof SheetForm>(key: K, value: SheetForm[K]) => void;
};

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

// Diagnóstico em comum, dentro de um `form-grid`.
export function SheetDiagnosisFields({
  form,
  errors,
  disabled,
  update,
}: SheetFieldsProps) {
  const [newNeed, setNewNeed] = useState('');

  function addNeed() {
    const need = newNeed.trim();

    if (!need) {
      return;
    }

    update('priorityNeeds', [...form.priorityNeeds, need]);
    setNewNeed('');
  }

  function moveNeedUp(index: number) {
    if (index === 0) {
      return;
    }

    const needs = [...form.priorityNeeds];
    [needs[index - 1], needs[index]] = [needs[index], needs[index - 1]];
    update('priorityNeeds', needs);
  }

  return (
    <>
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
          disabled={disabled}
          onChange={(event) => update('supportLevel', event.target.value)}
        >
          <option value="">Selecione</option>
          <option value="1">Nível 1</option>
          <option value="2">Nível 2</option>
          <option value="3">Nível 3</option>
        </select>
      </Field>

      <Field id="sheet-cid" label="CID" tip="Código da CID-10 do diagnóstico.">
        <input
          className="input"
          id="sheet-cid"
          type="text"
          placeholder="Ex.: F84.0"
          value={form.cid}
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          onChange={(event) => update('strengths', event.target.value)}
        />
      </Field>

      <div className="field full">
        <span className="ux-labeltip">
          <span className="field-label">
            Necessidades prioritárias <span className="muted">(em ordem)</span>
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
                  disabled={disabled || index === 0}
                  onClick={() => moveNeedUp(index)}
                >
                  <Icon name="up" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover ${need}`}
                  disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
            onClick={addNeed}
          >
            <Icon name="plus" />
            Adicionar
          </button>
        </div>
      </div>
    </>
  );
}

// Perfil de neurodivergência, vulnerabilidades e situação social.
export function SheetProfileFields({
  form,
  errors,
  disabled,
  update,
}: SheetFieldsProps) {
  return (
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
                disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
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
            <Field id="sheet-vuln" label="Vulnerabilidades e fatores de risco">
              <textarea
                className="input"
                id="sheet-vuln"
                rows={3}
                value={form.vulnerabilities}
                disabled={disabled}
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
                disabled={disabled}
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
}
