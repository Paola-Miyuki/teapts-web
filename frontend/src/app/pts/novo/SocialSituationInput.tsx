import React from 'react';

interface SocialSituationInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SocialSituationInput: React.FC<SocialSituationInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="form-group" style={{ marginBottom: '16px' }}>
      <label htmlFor="social-situation" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
        Situação Social *
      </label>
      <textarea
        id="social-situation"
        className="form-control"
        rows={4}
        placeholder="Descreva a situação social e contexto de vulnerabilidade do paciente..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />
    </div>
  );
};