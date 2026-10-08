import styles from '../pacientes.module.css';

type Patient = {
  id: number | string;
  name: string;
};

type PatientListItemProps = {
  patient: Patient;
};

export default function PatientListItem({ patient }: PatientListItemProps) {
  return (
    <li className={styles.patientItem}>
      <span className={styles.patientName}>{patient.name}</span>
    </li>
  );
}
