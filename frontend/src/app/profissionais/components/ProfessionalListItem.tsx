import type { Professional } from './Professionals';
import styles from '../profissionais.module.css';

type ProfessionalListItemProps = {
  professional: Professional;
};

export default function ProfessionalListItem({
  professional,
}: ProfessionalListItemProps) {
  const initial = professional.name.trim().charAt(0).toUpperCase();

  return (
    <tr>
      <td>
        <div className={styles.professionalCell}>
          <span className={styles.professionalAvatar} aria-hidden="true">
            {initial}
          </span>

          <div>
            <strong>{professional.name}</strong>
            <small>Profissional cadastrado</small>
          </div>
        </div>
      </td>

      <td data-label="E-mail">
        <span className={styles.email}>{professional.email}</span>
      </td>

      <td data-label="Especialidade">
        <span className={styles.badge}>
          <span className={styles.badgeDot} />
          {professional.specialism.name}
        </span>
      </td>
    </tr>
  );
}
