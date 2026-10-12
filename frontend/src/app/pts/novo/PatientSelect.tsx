import React from 'react';
import { PatientOption } from '@/types/pts';

interface PatientSelectProps {
  value: number | '';
  options: PatientOption[];
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const PatientSelect: React.FC<PatientSelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="form-group" style={{ marginBottom: '16px' }}>
      <label htmlFor="patient-select" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
        Paciente *
      </label>
      <select
        id="patient-select"
        className="form-control"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        required
        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      >
        <option value="">Selecione o paciente...</option>
        {options.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.name} (ID: {patient.id})
          </option>
        ))}
      </select>
    </div>
  );
};