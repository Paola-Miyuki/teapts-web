import type { Patient } from '../types';
import {
  fieldCls,
  fieldErrorCls,
  helpCls,
  inputCls,
  labelCls,
} from '../styles';

interface Props {
  patients: Patient[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function PatientSelect({
  patients,
  value,
  onChange,
  error,
  disabled,
}: Props) {
  return (
    <div className={fieldCls}>
      <label htmlFor="patient" className={labelCls}>
        Paciente
      </label>
      <div className="relative">
        <select
          id="patient"
          name="patient"
          required
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? 'patient-help patient-error' : 'patient-help'
          }
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls(!!error)} appearance-none pr-[44px]`}
        >
          <option value="">Selecione o paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-[15px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      <p id="patient-help" className={helpCls}>
        São elegíveis pacientes sem PTS aprovado ativo.
      </p>
      {error && (
        <p id="patient-error" className={fieldErrorCls}>
          {error}
        </p>
      )}
    </div>
  );
}
