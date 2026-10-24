import Icon from '@/components/Icon';
import styles from '../proposals.module.css';

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.stateCard} role="alert">
      <div className={styles.errorIcon}>
        <Icon name="alertCircle" />
      </div>

      <h2>Não foi possível carregar as propostas</h2>

      <p>{message}</p>

      <button type="button" className={styles.retryButton} onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}