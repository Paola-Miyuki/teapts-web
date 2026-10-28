import styles from '../proposals.module.css';

export default function LoadingState() {
  return (
    <div className={styles.loadingArea} role="status" aria-live="polite">
      <div className={styles.loadingCard}>
        <div className={styles.loadingHeader}>
          <span className={styles.loadingAvatar} />

          <div className={styles.loadingText}>
            <span />
            <span />
          </div>
        </div>

        <div className={styles.loadingBody}>
          <span />
          <span />
          <span />
        </div>
      </div>

      <p>Carregando propostas de PTS...</p>
    </div>
  );
}
