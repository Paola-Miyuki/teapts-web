import FormField from '@/components/FormField';
import type { SoapInput } from '@/lib/appointments';

export const SOAP_FIELDS: {
  key: keyof SoapInput;
  label: string;
  help: string;
  error: string;
}[] = [
  {
    key: 'soapSubjective',
    label: 'S, Subjetivo',
    help: 'Como o paciente chegou, relato da família, humor, estado de alerta.',
    error: 'Preencha o subjetivo',
  },
  {
    key: 'soapObjective',
    label: 'O, Objetivo',
    help: 'Dados observados: tempo na atividade, respostas aos comandos, agitação.',
    error: 'Preencha o objetivo',
  },
  {
    key: 'soapAssessment',
    label: 'A, Avaliação',
    help: 'Desempenho em relação às metas do PTS.',
    error: 'Preencha a avaliação',
  },
  {
    key: 'soapPlan',
    label: 'P, Plano',
    help: 'Próxima sessão e orientações à família.',
    error: 'Preencha o plano',
  },
];

// Seção "Evolução (SOAP)" de `registrar-atendimento.html`.
export default function SoapFields({
  values,
  errors,
  onChange,
}: {
  values: SoapInput;
  errors: Partial<Record<keyof SoapInput, string>>;
  onChange: (key: keyof SoapInput, value: string) => void;
}) {
  return (
    <section className="ux-fsection">
      <header>
        <h3>Evolução (SOAP)</h3>
      </header>
      <div>
        <div className="form-grid">
          {SOAP_FIELDS.map(({ key, label, help }) => (
            <FormField
              key={key}
              id={`appointment-${key}`}
              label={label}
              help={help}
              error={errors[key]}
              full
            >
              <textarea
                className="input"
                id={`appointment-${key}`}
                rows={3}
                aria-required="true"
                aria-invalid={Boolean(errors[key])}
                value={values[key]}
                onChange={(event) => onChange(key, event.target.value)}
              />
            </FormField>
          ))}
        </div>
      </div>
    </section>
  );
}
