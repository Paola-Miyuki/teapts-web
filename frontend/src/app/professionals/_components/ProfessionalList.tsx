import type { Professional } from '@/lib/professionals';
import ProfessionalListItem from './ProfessionalListItem';
import ui from '@/components/ui.module.css';
import styles from '../professionals.module.css';

type ProfessionalListProps = {
  professionals: Professional[];
  total: number;
};

export default function ProfessionalList({
  professionals,
  total,
}: ProfessionalListProps) {
  return (
    <div className={`${ui.card} ${styles.tableCard}`}>
      <div className={styles.tableHeader}>
        <div>
          <h2>Profissionais encontrados</h2>

          <p>
            {total}{' '}
            {total === 1
              ? 'profissional disponível'
              : 'profissionais disponíveis'}
          </p>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>E-mail</th>
              <th>Especialidade</th>
            </tr>
          </thead>

          <tbody>
            {professionals.map((professional) => (
              <ProfessionalListItem
                key={professional.id}
                professional={professional}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFoot}>
        <span>
          Somente dados necessários para identificação do profissional.
        </span>
      </div>
    </div>
  );
}
