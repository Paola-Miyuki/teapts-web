'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  type ClinicalData,
  type ClinicalDataPatch,
  updateClinicalData,
} from '@/lib/patients';
import styles from '../patients.module.css';

type ClinicalDataCardProps = {
  patientId: string;
  data: ClinicalData;
  canEdit: boolean;
  onSaved: (data: ClinicalData) => void;
};

type FormState = {
  allergies: string;
  noKnownAllergies: boolean;
  clinicalHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  habits: string;
  developmentalMilestones: string;
};

function toForm(data: ClinicalData): FormState {
  return {
    allergies: data.allergies ?? '',
    noKnownAllergies: data.noKnownAllergies,
    clinicalHistory: data.clinicalHistory ?? '',
    surgicalHistory: data.surgicalHistory ?? '',
    familyHistory: data.familyHistory ?? '',
    habits: data.habits ?? '',
    developmentalMilestones: data.developmentalMilestones ?? '',
  };
}

function ClinicalValue({ value }: { value: string | null }) {
  if (!value) {
    return <span className="empty-cell">Não informado</span>;
  }

  return <>{value}</>;
}

export default function ClinicalDataCard({
  patientId,
  data,
  canEdit,
  onSaved,
}: ClinicalDataCardProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(data));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const editable = canEdit && !forbidden;

  function startEditing() {
    setForm(toForm(data));
    setError('');
    setSuccess('');
    setEditing(true);
  }

  function cancelEditing() {
    setForm(toForm(data));
    setError('');
    setEditing(false);
  }

  function setField(
    field: Exclude<keyof FormState, 'noKnownAllergies'>,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body: ClinicalDataPatch = {
      allergies: form.noKnownAllergies ? '' : form.allergies,
      noKnownAllergies: form.noKnownAllergies,
      clinicalHistory: form.clinicalHistory,
      surgicalHistory: form.surgicalHistory,
      familyHistory: form.familyHistory,
      habits: form.habits,
      developmentalMilestones: form.developmentalMilestones,
    };

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const saved = await updateClinicalData(patientId, body);

      onSaved(saved);
      setForm(toForm(saved));
      setEditing(false);
      setSuccess('Dados clínicos atualizados com sucesso.');
    } catch (reason: unknown) {
      if (reason instanceof ApiError) {
        if (reason.status === 403) {
          setForbidden(true);
          setEditing(false);
        }

        setError(
          reason.apiMessage || 'Não foi possível atualizar os dados clínicos.',
        );
      } else {
        setError('Não foi possível atualizar os dados clínicos.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ux-card" aria-labelledby="clinical-data-title">
      <div className="ux-card-head">
        <div>
          <h2 id="clinical-data-title">Histórico clínico</h2>
        </div>

        {editable && !editing && (
          <button type="button" className="btn btn-sm" onClick={startEditing}>
            Editar
          </button>
        )}
      </div>

      {success && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}

      {error && <p role="alert">{error}</p>}

      {!editing ? (
        <ul className="mini-list">
          <li>
            <span className="grow">
              <span className="badge rejected">Alergias e restrições</span>
              <small className="ux-sub">
                {data.noKnownAllergies ? (
                  'Nenhuma alergia conhecida'
                ) : (
                  <ClinicalValue value={data.allergies} />
                )}
              </small>
            </span>
          </li>

          <li>
            <span className="grow">
              <strong>Antecedentes clínicos</strong>
              <small className="ux-sub">
                <ClinicalValue value={data.clinicalHistory} />
              </small>
            </span>
          </li>

          <li>
            <span className="grow">
              <strong>Antecedentes cirúrgicos</strong>
              <small className="ux-sub">
                <ClinicalValue value={data.surgicalHistory} />
              </small>
            </span>
          </li>

          <li>
            <span className="grow">
              <strong>Antecedentes familiares</strong>
              <small className="ux-sub">
                <ClinicalValue value={data.familyHistory} />
              </small>
            </span>
          </li>

          <li>
            <span className="grow">
              <strong>Hábitos</strong>
              <small className="ux-sub">
                <ClinicalValue value={data.habits} />
              </small>
            </span>
          </li>

          <li>
            <span className="grow">
              <strong>Marcos do desenvolvimento</strong>
              <small className="ux-sub">
                <ClinicalValue value={data.developmentalMilestones} />
              </small>
            </span>
          </li>
        </ul>
      ) : (
        <form onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.labelRow}>
              <input
                type="checkbox"
                checked={form.noKnownAllergies}
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    noKnownAllergies: event.target.checked,
                    allergies: event.target.checked ? '' : current.allergies,
                  }))
                }
              />
              <span>Nenhuma alergia conhecida</span>
            </label>
          </div>

          <div className={styles.field}>
            <label htmlFor="clinical-allergies">Alergias e restrições</label>
            <textarea
              id="clinical-allergies"
              className={`${ui.input} ${styles.textarea}`}
              value={form.allergies}
              disabled={saving || form.noKnownAllergies}
              onChange={(event) => setField('allergies', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="clinical-history">Antecedentes clínicos</label>
            <textarea
              id="clinical-history"
              className={`${ui.input} ${styles.textarea}`}
              value={form.clinicalHistory}
              disabled={saving}
              onChange={(event) =>
                setField('clinicalHistory', event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="surgical-history">Antecedentes cirúrgicos</label>
            <textarea
              id="surgical-history"
              className={`${ui.input} ${styles.textarea}`}
              value={form.surgicalHistory}
              disabled={saving}
              onChange={(event) =>
                setField('surgicalHistory', event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="family-history">Antecedentes familiares</label>
            <textarea
              id="family-history"
              className={`${ui.input} ${styles.textarea}`}
              value={form.familyHistory}
              disabled={saving}
              onChange={(event) =>
                setField('familyHistory', event.target.value)
              }
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="habits">Hábitos</label>
            <textarea
              id="habits"
              className={`${ui.input} ${styles.textarea}`}
              value={form.habits}
              disabled={saving}
              onChange={(event) => setField('habits', event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="developmental-milestones">
              Marcos do desenvolvimento
            </label>
            <textarea
              id="developmental-milestones"
              className={`${ui.input} ${styles.textarea}`}
              value={form.developmentalMilestones}
              disabled={saving}
              onChange={(event) =>
                setField('developmentalMilestones', event.target.value)
              }
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={cancelEditing}
            >
              Cancelar
            </button>

            <button type="submit" className="btn btn-sm" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
