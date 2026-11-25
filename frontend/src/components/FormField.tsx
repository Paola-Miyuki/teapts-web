import type { ReactNode } from 'react';

import HelpTooltip from '@/components/HelpTooltip';
import ui from '@/components/ui.module.css';

// Campo de formulário dos modais: label, "*" do obrigatório, "?" e erro. A
// ajuda e o erro usam os ids `${id}-tip` e `${id}-error`.
export default function FormField({
  id,
  label,
  help,
  error,
  full = false,
  required = true,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  full?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  const labelElement = (
    <label className="field-label" htmlFor={id}>
      {label}
      {required && (
        <span className="ux-req" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );

  return (
    <div className={full ? 'field full' : 'field'}>
      {help ? (
        <span className="ux-labeltip">
          {labelElement}
          <HelpTooltip id={`${id}-tip`} label={label}>
            {help}
          </HelpTooltip>
        </span>
      ) : (
        labelElement
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className={ui.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
