'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import HelpTooltip from '@/components/HelpTooltip';
import { cidDescription } from '@/lib/cid';
import { formatDateOnly } from '@/lib/format';
import type { PatientDiagnosis } from '@/lib/patients';

function Text({ value }: { value: string | null }) {
  return value?.trim() ? (
    <p className="ux-ptext">{value}</p>
  ) : (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ux-psec">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// Cartão "Diagnóstico" de `paciente.html`: o diagnóstico em comum do PTS atual
// (RN030), só leitura; a equipe o edita na ficha do PTS.
export default function DiagnosisCard({
  diagnosis,
}: {
  diagnosis: PatientDiagnosis;
}) {
  const description = diagnosis.cid ? cidDescription(diagnosis.cid) : null;
  const details = [
    diagnosis.cid ? 'CID-10' : null,
    diagnosis.supportLevel
      ? `Nível de suporte ${diagnosis.supportLevel}`
      : null,
    `Estudo de caso de ${formatDateOnly(diagnosis.caseStudyDate)}`,
  ].filter(Boolean);

  return (
    <section className="ux-card" aria-labelledby="d-diag">
      <div className="ux-card-head">
        <div>
          <span className="ux-titletip">
            <h2 id="d-diag">Diagnóstico</h2>
            <HelpTooltip id="d-diag-tip" label="Diagnóstico">
              Do PTS atual. A equipe atualiza na ficha do PTS.
            </HelpTooltip>
          </span>
        </div>
        <Link
          className="link"
          href={`/pts/${encodeURIComponent(diagnosis.ptsId)}${
            ['planning', 'running'].includes(diagnosis.ptsStatus)
              ? ''
              : '?readonly=1'
          }`}
        >
          Abrir PTS
        </Link>
      </div>

      <div className="ux-diag">
        {diagnosis.cid && <span className="ux-cid">{diagnosis.cid}</span>}
        <div>
          {description && <strong>{description}</strong>}
          <small>{details.join(' · ')}</small>
        </div>
      </div>

      <Section title="Síntese">
        <Text value={diagnosis.summary} />
      </Section>

      <Section title="Potencialidades">
        <Text value={diagnosis.strengths} />
      </Section>

      <Section title="Necessidades prioritárias">
        {diagnosis.priorityNeeds.length > 0 ? (
          <ol className="ux-ol">
            {diagnosis.priorityNeeds.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ol>
        ) : (
          <Text value={null} />
        )}
      </Section>

      <Section title="Situação social">
        <Text value={diagnosis.socialSituation} />
      </Section>
    </section>
  );
}
