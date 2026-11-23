import Icon from '@/components/Icon';

// Passos de `criar-pts.html` e `editar-proposta.html` com os campos que a API
// já tem: diagnóstico, metas e prazos entram com as tasks deles.
export const PTS_STEPS = [
  'Paciente',
  'Diagnóstico',
  'Equipe e prazos',
] as const;

export type PtsStep = 0 | 1 | 2;

// Indicador de passos (`ux-steps`): os anteriores com ✓, o atual marcado.
export default function WizardSteps({ current }: { current: PtsStep }) {
  return (
    <ol
      className="ux-steps"
      aria-label={`Passo ${current + 1} de ${PTS_STEPS.length}`}
    >
      {PTS_STEPS.map((label, index) => (
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
