import PatientListItem from './PatientListItem';
import styles from '../pacientes.module.css';

type Patient = {
  id: number | string;
  name: string;
};

type PatientListProps = {
  patients: Patient[];
};

export default function PatientList({ patients }: PatientListProps) {
  return (
    <section className={styles.card}>
      <div className={styles.listHeader}>
        <h2>Pacientes autorizados</h2>

        <span>
          {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
        </span>
      </div>

      <ul className={styles.list}>
        {patients.map((patient) => (
          <PatientListItem key={patient.id} patient={patient} />
        ))}
      </ul>
    </section>
  );
}
