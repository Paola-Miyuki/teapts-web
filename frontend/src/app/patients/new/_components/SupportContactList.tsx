import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { SupportContact } from '@/lib/patients';
import styles from '../new.module.css';

type SupportContactListProps = {
  contacts: SupportContact[];
  onRemove: (index: number) => void;
};

export default function SupportContactList({
  contacts,
  onRemove,
}: SupportContactListProps) {
  if (contacts.length === 0) {
    return null;
  }

  return (
    <ul className={styles.contactList} aria-label="Contatos de suporte">
      {contacts.map((contact, index) => {
        const reach = [contact.email, contact.phone]
          .filter(Boolean)
          .join(' · ');

        return (
          <li key={`${index}-${contact.name}`} className={styles.contactRow}>
            <div>
              <strong>{contact.name}</strong>

              <p>{contact.description || 'Contato de suporte'}</p>

              {reach && <p>{reach}</p>}
            </div>

            <button
              type="button"
              className={styles.iconButton}
              aria-label={`Remover contato ${contact.name}`}
              onClick={() => onRemove(index)}
            >
              <Icon name="trash" className={ui.icon} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
