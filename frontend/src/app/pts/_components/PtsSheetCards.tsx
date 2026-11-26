import type { ReactNode } from 'react';

import HelpTooltip from '@/components/HelpTooltip';
import type { ActivePts, PtsDetail } from '@/lib/pts';

type PtsSheet = Pick<
  ActivePts & PtsDetail,
  | 'caseStudyDate'
  | 'diagnosisSummary'
  | 'cid'
  | 'supportLevel'
  | 'strengths'
  | 'priorityNeeds'
  | 'socialSituation'
  | 'vulnerabilities'
  | 'comorbidities'
  | 'sensoryProfile'
  | 'communicationMethod'
>;

// Datas da ficha chegam como yyyy-mm-dd: formatar sem passar por fuso.
export function formatSheetDate(value: string | undefined | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');

  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ux-psec">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Text({ value }: { value: string | null | undefined }) {
  return value?.trim() ? (
    <p className="ux-ptext">{value}</p>
  ) : (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

// Cartões da ficha na visão geral (RFPTS005, pts-detalhe.html). Só a equipe e
// o admin os recebem: o paciente não vê a ficha (RN028).
export default function PtsSheetCards({ pts }: { pts: PtsSheet }) {
  const details = [
    pts.cid ? 'CID-10' : null,
    pts.supportLevel ? `Nível de suporte ${pts.supportLevel}` : null,
    formatSheetDate(pts.caseStudyDate)
      ? `Estudo de caso de ${formatSheetDate(pts.caseStudyDate)}`
      : null,
  ].filter(Boolean);

  return (
    <div className="ux-stack">
      <section className="ux-card" aria-labelledby="pv-diag">
        <div className="ux-card-head">
          <div>
            <h2 id="pv-diag">Diagnóstico</h2>
          </div>
        </div>

        {(pts.cid || details.length > 0) && (
          <div className="ux-diag">
            {pts.cid && <span className="ux-cid">{pts.cid}</span>}
            <div>
              <small>{details.join(' · ')}</small>
            </div>
          </div>
        )}

        <Section title="Síntese">
          <Text value={pts.diagnosisSummary} />
        </Section>
        <Section title="Potencialidades">
          <Text value={pts.strengths} />
        </Section>
        <Section title="Necessidades prioritárias">
          {pts.priorityNeeds && pts.priorityNeeds.length > 0 ? (
            <ol className="ux-ol">
              {pts.priorityNeeds.map((need, index) => (
                <li key={`${index}-${need}`}>{need}</li>
              ))}
            </ol>
          ) : (
            <Text value={null} />
          )}
        </Section>
      </section>

      <section className="ux-card" aria-labelledby="pv-profile">
        <div className="ux-card-head">
          <div>
            <h2 id="pv-profile">Perfil de neurodivergência</h2>
          </div>
        </div>

        <Section title="Comorbidades">
          <Text value={pts.comorbidities} />
        </Section>
        <Section title="Método de comunicação">
          <Text value={pts.communicationMethod} />
        </Section>
        <Section title="Perfil sensorial">
          <Text value={pts.sensoryProfile} />
        </Section>
      </section>

      <section className="ux-card" aria-labelledby="pv-vuln">
        <div className="ux-card-head">
          <div>
            <span className="ux-titletip">
              <h2 id="pv-vuln">Vulnerabilidades e situação social</h2>
              <HelpTooltip id="pv-vuln-tip" label="Situação social">
                A situação social não aparece ao paciente.
              </HelpTooltip>
            </span>
          </div>
        </div>

        <Section title="Vulnerabilidades e fatores de risco">
          <Text value={pts.vulnerabilities} />
        </Section>
        <Section title="Situação social">
          <Text value={pts.socialSituation} />
        </Section>
      </section>
    </div>
  );
}
