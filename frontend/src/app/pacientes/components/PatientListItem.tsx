import styles from '../pacientes.module.css';

type Patient = {
  id: number | string;
  name: string;
};

type PatientListItemProps = {
  patient: Patient;
};

export default function PatientListItem({ patient }: PatientListItemProps) {
  const initial = patient.name.trim().charAt(0).toUpperCase();

  return (
    <tr>
      <td>
        <div className={styles.patientCell}>
          <span className={styles.patientAvatar} aria-hidden="true">
            {initial}
          </span>

          <div>
            <strong>{patient.name}</strong>
            <small>Paciente autorizado</small>
          </div>
        </div>
      </td>

      <td data-label="Situação do PTS">
        <span className={styles.badge}>
          <span className={styles.badgeDot} />
          Não informada
        </span>
      </td>

      <td data-label="Acompanhamento">
        <span className={styles.actionLabel}>
          Visualizar PTS
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M4 12h16m-6-6 6 6-6 6" />
          </svg>
        </span>
      </td>
    </tr>
  );
}
