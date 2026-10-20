import styles from '../proposals.module.css';

type EmptyStateProps = {
  title: string;
  message: string;
};

export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className={styles.stateCard}>
      <div className={styles.stateIcon}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="4" width="14" height="17" rx="2" />

          <path d="M9 3h6v3H9zM9 11h6m-6 4h4" />
        </svg>
      </div>

      <h2>{title}</h2>

      <p>{message}</p>
    </div>
  );
}
