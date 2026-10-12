import React from 'react';
import { ProfessionalOption } from '@/types/pts';

interface ProfessionalTeamSelectProps {
  selectedIds: number[];
  options: ProfessionalOption[];
  onChange: (selectedIds: number[]) => void;
  disabled?: boolean;
}

export const ProfessionalTeamSelect: React.FC<ProfessionalTeamSelectProps> = ({
  selectedIds,
  options,
  onChange,
  disabled = false,
}) => {
  const handleToggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="form-group" style={{ marginBottom: '24px' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
        Equipe Inicial (Opcional)
      </label>
      <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((prof) => (
          <label key={prof.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedIds.includes(prof.id)}
              onChange={() => handleToggle(prof.id)}
              disabled={disabled}
            />
            <span>{prof.name} ({prof.role})</span>
          </label>
        ))}
      </div>
    </div>
  );
};