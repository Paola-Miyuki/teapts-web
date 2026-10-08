import styles from '../pacientes.module.css';

export default function LoadingState() {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <div>
        <div className={styles.loader} />

        <p>Carregando pacientes...</p>
      </div>
    </div>
  );
}
