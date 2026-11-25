'use client';

import type { ClinicalData } from '@/lib/patients';

function ClinicalValue({ value }: { value: string | null }) {
  if (!value) {
    return <span className="empty-cell">Não informado</span>;
  }

  return <>{value}</>;
}

// Cartão "Histórico clínico" de `paciente.html` (RFPAC007), só leitura: os
// dados são editados no modal "Editar paciente".
export default function ClinicalDataCard({ data }: { data: ClinicalData }) {
  return (
    <section className="ux-card" aria-labelledby="clinical-data-title">
      <div className="ux-card-head">
        <div>
          <h2 id="clinical-data-title">Histórico clínico</h2>
        </div>
      </div>

      <div className="ux-anam-grid">
        <div className="ux-anam-tile">
          <h3>Antecedentes clínicos</h3>
          <p>
            <ClinicalValue value={data.clinicalHistory} />
          </p>
        </div>

        <div className="ux-anam-tile">
          <h3>Antecedentes cirúrgicos</h3>
          <p>
            <ClinicalValue value={data.surgicalHistory} />
          </p>
        </div>

        <div className="ux-anam-tile">
          <h3>Antecedentes familiares</h3>
          <p>
            <ClinicalValue value={data.familyHistory} />
          </p>
        </div>

        <div className="ux-anam-tile">
          <h3>Hábitos</h3>
          <p>
            <ClinicalValue value={data.habits} />
          </p>
        </div>

        <div className="ux-anam-tile">
          <h3>Marcos do desenvolvimento</h3>
          <p>
            <ClinicalValue value={data.developmentalMilestones} />
          </p>
        </div>

        <div className="ux-anam-tile is-alert">
          <h3>Alergias e restrições</h3>
          <p>
            {data.noKnownAllergies ? (
              'Nenhuma alergia conhecida'
            ) : (
              <ClinicalValue value={data.allergies} />
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
