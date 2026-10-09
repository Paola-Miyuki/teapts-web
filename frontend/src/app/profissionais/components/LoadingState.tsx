import styles from '../profissionais.module.css';

export default function LoadingState() {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <div>
        <div className={styles.loader} />

        <p>Carregando profissionais...</p>
      </div>
    </div>
  );
}
