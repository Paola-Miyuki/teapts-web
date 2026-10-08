import styles from '../pacientes.module.css';

export default function LoadingState() {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <p>Carregando pacientes...</p>
    </div>
  );
}
