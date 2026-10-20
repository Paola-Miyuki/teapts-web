import styles from '../proposals.module.css';

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.stateCard} role="alert">
      <div className={styles.errorIcon}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 17h.01" />
        </svg>
      </div>

      <h2>Não foi possível carregar as propostas</h2>

      <p>{message}</p>

      <button type="button" className={styles.retryButton} onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}
