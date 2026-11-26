'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';
import {
  formatRegistration,
  type ProfessionalRegistration,
} from '@/lib/professionals';

// Registro no conselho com o botão de copiar, como em `profissionais.html`
// e na aba Equipe de `pts-detalhe.html`; sem registro, "—".
export default function RegistrationCell({
  registration,
}: {
  registration: ProfessionalRegistration | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!registration) {
    return (
      <span className="empty-cell" aria-label="Não informado">
        —
      </span>
    );
  }

  const label = formatRegistration(registration);

  return (
    <span className="copy-cell">
      {label}
      <button
        type="button"
        className="copy-btn"
        aria-label={copied ? 'Registro copiado' : `Copiar Registro ${label}`}
        title={copied ? 'Registro copiado' : undefined}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(label)
            .then(() => setCopied(true));
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} className="icon-sm" />
      </button>
    </span>
  );
}
