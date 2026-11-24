'use client';

import { useState } from 'react';

import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import { formatPhone, initials } from '@/lib/format';
import type { SupportContact } from '@/lib/patients';
import RemoveSupportContactDialog from './RemoveSupportContactDialog';
import SupportContactDialog from './SupportContactDialog';

type SupportContactsCardProps = {
  // accountId do perfil de paciente.
  patientId: string;
  patientName: string;
  contacts: SupportContact[];
  // Com edição (admin ou membro de PTS ativo, RN024), cada contato tem Editar
  // e Remover e o cartão tem Adicionar contato; sem ela, só leitura.
  canEdit: boolean;
  onChange: (contacts: SupportContact[]) => void;
};

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; contact: SupportContact }
  | { kind: 'remove'; contact: SupportContact }
  | null;

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

// Cartão "Contatos de suporte" (`paciente.html`, `meu-perfil.html`).
// Contato de suporte não concede acesso (RN017).
export default function SupportContactsCard({
  patientId,
  patientName,
  contacts,
  canEdit,
  onChange,
}: SupportContactsCardProps) {
  const [dialog, setDialog] = useState<Dialog>(null);

  function close() {
    setDialog(null);
  }

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
        {canEdit && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDialog({ kind: 'add' })}
          >
            <Icon name="plus" className="icon-sm" />
            Adicionar contato
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="hint">Nenhum contato de suporte cadastrado.</p>
      ) : canEdit ? (
        <ul className="mini-list">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <span className="grow">
                <strong>{contact.name}</strong>
                {contact.isEmergency && (
                  <span className="badge rejected">Emergência</span>
                )}
                <Details contact={contact} />
              </span>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`Editar ${contact.name}`}
                onClick={() => setDialog({ kind: 'edit', contact })}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`Remover ${contact.name}`}
                onClick={() => setDialog({ kind: 'remove', contact })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
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

      {dialog?.kind === 'add' && (
        <SupportContactDialog
          patientId={patientId}
          patientName={patientName}
          onClose={close}
          onSaved={(saved) => {
            onChange([...contacts, saved]);
            close();
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <SupportContactDialog
          patientId={patientId}
          patientName={patientName}
          contact={dialog.contact}
          onClose={close}
          onSaved={(saved) => {
            onChange(
              contacts.map((current) =>
                current.id === saved.id ? saved : current,
              ),
            );
            close();
          }}
        />
      )}
      <RemoveSupportContactDialog
        patientId={patientId}
        contact={dialog?.kind === 'remove' ? dialog.contact : null}
        onClose={close}
        onRemoved={(removed) => {
          onChange(contacts.filter((current) => current.id !== removed.id));
          close();
        }}
      />
    </section>
  );
}
