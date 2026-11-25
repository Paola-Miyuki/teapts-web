import Icon from '@/components/Icon';

// Passos de `criar-pts.html` com os campos que a criação já tem: diagnóstico e
// metas entram com a RFPTS001.
export const PTS_STEPS = [
  'Paciente',
  'Diagnóstico',
  'Equipe e prazos',
] as const;

export type PtsStep = 0 | 1 | 2;

// Edição da proposta (RFPTS007, RFPTS013).
export const PROPOSAL_STEPS = [
  'Paciente',
  'Diagnóstico',
  'Metas',
  'Equipe e prazos',
] as const;

export type ProposalStep = 0 | 1 | 2 | 3;

// Indicador de passos (`ux-steps`): os anteriores com ✓, o atual marcado.
export default function WizardSteps({
  current,
  steps = PTS_STEPS,
}: {
  current: number;
  steps?: readonly string[];
}) {
  return (
    <ol
      className="ux-steps"
      aria-label={`Passo ${current + 1} de ${steps.length}`}
    >
      {steps.map((label, index) => (
        <li
          key={label}
          className={index < current ? 'is-done' : undefined}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="ux-step-n">
            {index < current ? <Icon name="check" /> : index + 1}
          </span>
          <span className="ux-step-l">{label}</span>
        </li>
      ))}
    </ol>
  );
}
