import type { Patient } from '../types';
import Icon from '@/components/Icon';
import styles from '../novo.module.css';
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
      <div className={styles.selectWrap}>
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
          className={`${inputCls(!!error)} ${styles.select}`}
        >
          <option value="">Selecione o paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>

        <Icon name="chevronDown" className={styles.selectChevron} />
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
