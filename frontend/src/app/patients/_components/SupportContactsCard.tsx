'use client';

import HelpTooltip from '@/components/HelpTooltip';
import { formatPhone, initials } from '@/lib/format';
import type { SupportContact } from '@/lib/patients';

function Details({ contact }: { contact: SupportContact }) {
  return (
    <>
      {contact.description && (
        <small className="ux-sub">
          <span className="ux-sublabel">Descrição:</span> {contact.description}
        </small>
      )}
      {contact.email && (
        <small className="ux-sub">
          <span className="ux-sublabel">E-mail:</span> {contact.email}
        </small>
      )}
      {contact.phone && (
        <small className="ux-sub">
          <span className="ux-sublabel">Telefone:</span>{' '}
          {formatPhone(contact.phone)}
        </small>
      )}
    </>
  );
}

// Cartão "Contatos de suporte" (`paciente.html`, `meu-perfil.html`), só
// leitura: os contatos são editados no modal "Editar paciente". Contato de
// suporte não concede acesso (RN017).
export default function SupportContactsCard({
  contacts,
}: {
  contacts: SupportContact[];
}) {
  return (
    <section className="ux-card" aria-labelledby="d-support">
      <div className="ux-card-head">
        <div>
          <span className="ux-titletip">
            <h2 id="d-support">Contatos de suporte</h2>
            <HelpTooltip id="d-support-tip" label="Contatos de suporte">
              Pessoas que ajudam no cuidado. Não acessam o sistema nem os dados
              clínicos.
            </HelpTooltip>
          </span>
        </div>
      </div>

      {contacts.length === 0 ? (
        <p className="hint">Nenhum contato de suporte cadastrado.</p>
      ) : (
        <ul className="ux-contact-tiles">
          {contacts.map((contact) => (
            <li className="ux-contact-tile" key={contact.id}>
              <span className="avatar" aria-hidden="true">
                {initials(contact.name)}
              </span>
              <div>
                <strong>{contact.name}</strong>
                {contact.isEmergency && (
                  <span className="badge rejected">Emergência</span>
                )}
                <Details contact={contact} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
