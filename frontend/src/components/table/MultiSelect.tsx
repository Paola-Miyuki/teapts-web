'use client';

import Icon from '@/components/Icon';

export type MultiOption = { value: string; label: string };

type MultiSelectProps = {
  label: string;
  options: MultiOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
};

// Seleção múltipla dos filtros (`details.multi` dos mockups).
export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Todos',
}: MultiSelectProps) {
  const selected = options.filter((option) => value.includes(option.value));
  const summary =
    selected.length === 0
      ? placeholder
      : selected.map((option) => option.label).join(', ');

  function toggle(optionValue: string, checked: boolean) {
    onChange(
      checked
        ? [...value, optionValue]
        : value.filter((item) => item !== optionValue),
    );
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>

      <details className="multi">
        <summary aria-label={`${label}: ${summary}`}>
          <span className="multi-value">{summary}</span>
          <Icon name="chevronDown" className="icon-sm" />
        </summary>

        <div className="multi-panel">
          {options.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                value={option.value}
                checked={value.includes(option.value)}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
