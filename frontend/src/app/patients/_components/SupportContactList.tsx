import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { SupportContact } from '@/lib/patients';
import styles from '../patients.module.css';

type SupportContactListProps = {
  contacts: SupportContact[];
  onRemove: (index: number) => void;
};

// Mesma ordem do formulário: nome e descrição ocupam a linha inteira.
const FIELDS = [
  { key: 'name', label: 'Nome', wide: true },
  { key: 'email', label: 'E-mail', wide: false },
  { key: 'phone', label: 'Telefone', wide: false },
  { key: 'description', label: 'Descrição', wide: true },
] as const;

export default function SupportContactList({
  contacts,
  onRemove,
}: SupportContactListProps) {
  if (contacts.length === 0) {
    return null;
  }

  return (
    <ul className={styles.contactList} aria-label="Contatos de suporte">
      {contacts.map((contact, index) => (
        <li key={`${index}-${contact.name}`} className={styles.contactRow}>
          <dl className={styles.contactData}>
            {FIELDS.map(({ key, label, wide }) => (
              <div key={key} className={wide ? styles.fullWidth : undefined}>
                <dt>{label}</dt>

                <dd className={contact[key] ? undefined : styles.missing}>
                  {contact[key] || 'Não informado'}
                </dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Remover contato ${contact.name}`}
            onClick={() => onRemove(index)}
          >
            <Icon name="trash" className={ui.icon} />
          </button>
        </li>
      ))}
    </ul>
  );
}
