'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  createMedication,
  getMedications,
  stopMedication,
  updateMedication,
  type Medication,
  type MedicationInput,
} from '@/lib/patients';
import styles from '../patients.module.css';

type MedicationsCardProps = {
  patientId: string;
  canEdit: boolean;
};

type MedicationForm = {
  drugName: string;
  dose: string;
  frequency: string;
  prescriber: string;
  reason: string;
  startDate: string;
  endDate: string;
};

type Editor = { kind: 'add' } | { kind: 'edit'; medication: Medication } | null;

type Filter = 'active' | 'stopped' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Em uso' },
  { value: 'stopped', label: 'Suspensas' },
];

const EMPTY_FORM: MedicationForm = {
  drugName: '',
  dose: '',
  frequency: '',
  prescriber: '',
  reason: '',
  startDate: '',
  endDate: '',
};

function toForm(medication: Medication): MedicationForm {
  return {
    drugName: medication.drugName,
    dose: medication.dose,
    frequency: medication.frequency,
    prescriber: medication.prescriber ?? '',
    reason: medication.reason ?? '',
    startDate: medication.startDate,
    endDate: medication.endDate ?? '',
  };
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
  });
}

function toInput(form: MedicationForm): MedicationInput {
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

export default function MedicationsCard({
  patientId,
  canEdit,
}: MedicationsCardProps) {
  const router = useRouter();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const [filter, setFilter] = useState<Filter>('all');

  const [editor, setEditor] = useState<Editor>(null);
  const [form, setForm] = useState<MedicationForm>(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [writeForbidden, setWriteForbidden] = useState(false);

  const canWrite = canEdit && !writeForbidden;

  useEffect(() => {
    const controller = new AbortController();

    getMedications(patientId, controller.signal)
      .then((response) => {
        setMedications(response.data);
        setLoading(false);
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
            : 'Não foi possível carregar as medicações',
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [patientId, retryKey, router]);

  const visibleMedications = useMemo(() => {
    return [...medications]
      .filter((medication) => {
        if (filter === 'active') {
          return medication.endDate === null;
        }

        if (filter === 'stopped') {
          return medication.endDate !== null;
        }

        return true;
      })
      .sort((a, b) => {
        const aActive = a.endDate === null;
        const bActive = b.endDate === null;

        if (aActive !== bActive) {
          return aActive ? -1 : 1;
        }

        return b.startDate.localeCompare(a.startDate);
      });
  }, [filter, medications]);

  function startAdd() {
    setForm(EMPTY_FORM);
    setActionError('');
    setSuccess('');
    setEditor({ kind: 'add' });
  }

  function startEdit(medication: Medication) {
    setForm(toForm(medication));
    setActionError('');
    setSuccess('');
    setEditor({ kind: 'edit', medication });
  }

  function cancelEditor() {
    setEditor(null);
    setForm(EMPTY_FORM);
    setActionError('');
  }

  function setField(field: keyof MedicationForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleApiError(reason: unknown, fallback: string) {
    if (reason instanceof ApiError) {
      if (reason.status === 401) {
        router.replace('/login');
        return;
      }

      if (reason.status === 403) {
        setWriteForbidden(true);
        setEditor(null);
      }

      setActionError(reason.apiMessage || fallback);
      return;
    }

    setActionError(fallback);
  }

  async function saveMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActionError('');
    setSuccess('');

    if (
      !form.drugName.trim() ||
      !form.dose.trim() ||
      !form.frequency.trim() ||
      !form.startDate
    ) {
      setActionError('Informe medicamento, dose, frequência e data de início');
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setActionError('A data de fim não pode ser anterior à data de início');
      return;
    }

    const input = toInput(form);

    setSaving(true);

    try {
      if (editor?.kind === 'edit') {
        const saved = await updateMedication(
          patientId,
          editor.medication.id,
          input,
        );

        setMedications((current) =>
          current.map((medication) =>
            medication.id === saved.id ? saved : medication,
          ),
        );

        setSuccess('Medicação atualizada com sucesso');
      } else {
        const saved = await createMedication(patientId, input);

        setMedications((current) => [...current, saved]);
        setSuccess('Medicação adicionada com sucesso');
      }

      setEditor(null);
      setForm(EMPTY_FORM);
    } catch (reason: unknown) {
      handleApiError(
        reason,
        editor?.kind === 'edit'
          ? 'Não foi possível atualizar a medicação'
          : 'Não foi possível adicionar a medicação.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function suspend(medication: Medication) {
    setActionError('');
    setSuccess('');
    setStoppingId(medication.id);

    try {
      const saved = await stopMedication(patientId, medication.id);

      setMedications((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );

      setSuccess('Medicação suspensa com sucesso');
    } catch (reason: unknown) {
      handleApiError(reason, 'Não foi possível suspender a medicação');
    } finally {
      setStoppingId(null);
    }
  }

  return (
    <section className="ux-card" aria-labelledby="medications-title">
      <div className="ux-card-head">
        <div>
          <h2 id="medications-title">Medicações</h2>
        </div>

        {canWrite && !editor && (
          <button type="button" className="btn btn-sm" onClick={startAdd}>
            Adicionar medicação
          </button>
        )}
      </div>

      {success && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}

      {actionError && <p role="alert">{actionError}</p>}

      {loading ? (
        <div role="status" aria-live="polite">
          <div className={styles.loader} />
          <p>Carregando medicações...</p>
        </div>
      ) : loadError ? (
        <div role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className={`btn btn-sm ${styles.retry}`}
            onClick={() => {
              setLoading(true);
              setLoadError('');
              setRetryKey((current) => current + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <nav className="tabs ux-ptabs" aria-label="Situação das medicações">
            {FILTERS.map(({ value, label }) => (
              <a
                key={value}
                href={`#${value}`}
                aria-current={filter === value ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setFilter(value);
                }}
              >
                {label}
              </a>
            ))}
          </nav>

          {visibleMedications.length === 0 ? (
            <p className="hint">Nenhuma medicação encontrada.</p>
          ) : (
            <ul className="mini-list">
              {visibleMedications.map((medication) => (
                <li key={medication.id}>
                  <span className="grow">
                    <strong>{medication.drugName}</strong>

                    <span
                      className={
                        medication.endDate ? 'badge rejected' : 'badge'
                      }
                    >
                      {medication.endDate ? 'Suspensa' : 'Em uso'}
                    </span>

                    <small className="ux-sub">Dose: {medication.dose}</small>

                    <small className="ux-sub">
                      Frequência: {medication.frequency}
                    </small>

                    {medication.prescriber && (
                      <small className="ux-sub">
                        Prescritor: {medication.prescriber}
                      </small>
                    )}

                    {medication.reason && (
                      <small className="ux-sub">
                        Motivo: {medication.reason}
                      </small>
                    )}

                    <small className="ux-sub">
                      Início: {formatDate(medication.startDate)}
                    </small>

                    {medication.endDate && (
                      <small className="ux-sub">
                        Fim: {formatDate(medication.endDate)}
                      </small>
                    )}
                  </span>

                  {canWrite && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`Editar ${medication.drugName}`}
                        onClick={() => startEdit(medication)}
                      >
                        Editar
                      </button>

                      {!medication.endDate && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          aria-label={`Suspender ${medication.drugName}`}
                          disabled={stoppingId === medication.id}
                          onClick={() => suspend(medication)}
                        >
                          {stoppingId === medication.id
                            ? 'Suspendendo...'
                            : 'Suspender'}
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editor && (
        <form onSubmit={saveMedication}>
          <div className={styles.field}>
            <label htmlFor="medication-drug-name">Medicamento</label>
            <input
              id="medication-drug-name"
              className={ui.input}
              placeholder="Ex.: Risperidona"
              value={form.drugName}
              required
              disabled={saving}
              onChange={(event) => setField('drugName', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="medication-dose">Dose</label>
            <input
              id="medication-dose"
              className={ui.input}
              placeholder="Ex.: 0,5 mg"
              value={form.dose}
              required
              disabled={saving}
              onChange={(event) => setField('dose', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="medication-frequency">Frequência</label>
            <input
              id="medication-frequency"
              className={ui.input}
              placeholder="Ex.: 1x ao dia, à noite"
              value={form.frequency}
              required
              disabled={saving}
              onChange={(event) => setField('frequency', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="medication-prescriber">Prescritor</label>
            <input
              id="medication-prescriber"
              className={ui.input}
              value={form.prescriber}
              disabled={saving}
              onChange={(event) => setField('prescriber', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="medication-reason">Motivo</label>
            <textarea
              id="medication-reason"
              className={`${ui.input} ${styles.textarea}`}
              value={form.reason}
              disabled={saving}
              onChange={(event) => setField('reason', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="medication-start-date">Início</label>
            <input
              id="medication-start-date"
              className={ui.input}
              type="date"
              value={form.startDate}
              required
              disabled={saving}
              onChange={(event) => setField('startDate', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="medication-end-date">Fim</label>
            <input
              id="medication-end-date"
              className={ui.input}
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              disabled={saving}
              onChange={(event) => setField('endDate', event.target.value)}
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={cancelEditor}
            >
              Cancelar
            </button>

            <button type="submit" className="btn btn-sm" disabled={saving}>
              {saving
                ? 'Salvando...'
                : editor.kind === 'edit'
                  ? 'Salvar alterações'
                  : 'Adicionar'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
