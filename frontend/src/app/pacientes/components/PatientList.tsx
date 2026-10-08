import PatientListItem from './PatientListItem';
import styles from '../pacientes.module.css';

type Patient = {
  id: number | string;
  name: string;
};

type PatientListProps = {
  patients: Patient[];
  page: number;
};

export default function PatientList({ patients, page }: PatientListProps) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Situação do PTS</th>
              <th>Acompanhamento</th>
            </tr>
          </thead>

          <tbody>
            {patients.map((patient) => (
              <PatientListItem key={patient.id} patient={patient} />
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFoot}>
        <span>Somente pacientes vinculados ao seu acesso.</span>

        <span className={styles.pageNumber}>
          {String(page).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
