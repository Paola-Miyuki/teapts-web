'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import HelpTooltip from '@/components/HelpTooltip';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  createMedication,
  updateMedication,
  type Medication,
  type MedicationInput,
} from '@/lib/patients';

type MedicationFormDialogProps = {
  patientId: string;
  patientName?: string;
  // Sem `medication`, adiciona; com ela, edita.
  medication?: Medication;
  onClose: () => void;
  onSaved: (medication: Medication) => void;
  // A API recusou a gravação (403): o card mostra a mensagem e esconde as
  // ações de escrita.
  onForbidden: (message: string) => void;
};

const SAVE_ERROR = {
  add: 'Não foi possível adicionar a medicação',
  edit: 'Não foi possível atualizar a medicação',
};

function toInput(form: {
  drugName: string;
  dose: string;
  frequency: string;
  prescriber: string;
  reason: string;
  startDate: string;
  endDate: string;
}): MedicationInput {
  const prescriber = form.prescriber.trim();
  const reason = form.reason.trim();
  const endDate = form.endDate.trim();

  return {
    drugName: form.drugName.trim(),
    dose: form.dose.trim(),
    frequency: form.frequency.trim(),
    startDate: form.startDate,
    ...(prescriber ? { prescriber } : {}),
    ...(reason ? { reason } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

// Modal "Adicionar medicação" de `paciente.html` (RFPAC007); também edita uma
// medicação existente, com os mesmos campos.
export default function MedicationFormDialog({
  patientId,
  patientName,
  medication,
  onClose,
  onSaved,
  onForbidden,
}: MedicationFormDialogProps) {
  const router = useRouter();
  const mode = medication ? 'edit' : 'add';
  const formId = 'medication-form';

  const [drugName, setDrugName] = useState(medication?.drugName ?? '');
  const [dose, setDose] = useState(medication?.dose ?? '');
  const [frequency, setFrequency] = useState(medication?.frequency ?? '');
  const [prescriber, setPrescriber] = useState(medication?.prescriber ?? '');
  const [reason, setReason] = useState(medication?.reason ?? '');
  const [startDate, setStartDate] = useState(medication?.startDate ?? '');
  const [endDate, setEndDate] = useState(medication?.endDate ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!drugName.trim() || !dose.trim() || !frequency.trim() || !startDate) {
      setError('Informe medicamento, dose, frequência e data de início');
      return;
    }

    if (endDate && endDate < startDate) {
      setError('A data de fim não pode ser anterior à data de início');
      return;
    }

    const input = toInput({
      drugName,
      dose,
      frequency,
      prescriber,
      reason,
      startDate,
      endDate,
    });

    setSubmitting(true);

    try {
      const saved = medication
        ? await updateMedication(patientId, medication.id, input)
        : await createMedication(patientId, input);

      onSaved(saved);
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace('/login');
        return;
      }

      const message =
        reason instanceof ApiError && reason.apiMessage
          ? reason.apiMessage
          : SAVE_ERROR[mode];

      if (reason instanceof ApiError && reason.status === 403) {
        onForbidden(message);
        return;
      }

      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      id={formId}
      icon={mode === 'edit' ? 'edit' : 'plus'}
      title={mode === 'edit' ? 'Editar medicação' : 'Adicionar medicação'}
      description={patientName}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting
              ? 'Salvando...'
              : mode === 'edit'
                ? 'Salvar alterações'
                : 'Adicionar medicação'}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit}>
        {error && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{error}</p>
          </div>
        )}

        <div className="form-grid">
          <div className="field full">
            <label className="field-label" htmlFor={`${formId}-drug`}>
              Medicamento
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <input
              className="input"
              id={`${formId}-drug`}
              type="text"
              aria-required="true"
              placeholder="Ex.: Risperidona"
              value={drugName}
              disabled={submitting}
              onChange={(event) => setDrugName(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`${formId}-dose`}>
              Dose
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <input
              className="input"
              id={`${formId}-dose`}
              type="text"
              aria-required="true"
              placeholder="Ex.: 0,5 mg"
              value={dose}
              disabled={submitting}
              onChange={(event) => setDose(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`${formId}-frequency`}>
              Frequência
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <input
              className="input"
              id={`${formId}-frequency`}
              type="text"
              aria-required="true"
              placeholder="Ex.: 1x ao dia, à noite"
              value={frequency}
              disabled={submitting}
              onChange={(event) => setFrequency(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`${formId}-prescriber`}>
              Prescritor
            </label>
            <input
              className="input"
              id={`${formId}-prescriber`}
              type="text"
              placeholder="Ex.: Dr. Carlos Lima"
              value={prescriber}
              disabled={submitting}
              onChange={(event) => setPrescriber(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`${formId}-start`}>
              Data de início
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <input
              className="input"
              id={`${formId}-start`}
              type="date"
              aria-required="true"
              value={startDate}
              disabled={submitting}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="field">
            <span className="ux-labeltip">
              <label className="field-label" htmlFor={`${formId}-end`}>
                Data de fim
              </label>
              <HelpTooltip id={`${formId}-end-tip`} label="Data de fim">
                Deixe em branco se estiver em uso.
              </HelpTooltip>
            </span>
            <input
              className="input"
              id={`${formId}-end`}
              type="date"
              min={startDate || undefined}
              aria-describedby={`${formId}-end-tip`}
              value={endDate}
              disabled={submitting}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className="field full">
            <label className="field-label" htmlFor={`${formId}-reason`}>
              Motivo
            </label>
            <textarea
              className="input"
              id={`${formId}-reason`}
              rows={2}
              value={reason}
              disabled={submitting}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
