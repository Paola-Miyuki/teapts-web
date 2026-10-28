import Icon from '@/components/Icon';
import styles from '../proposals.module.css';

type EmptyStateProps = {
  title: string;
  message: string;
};

export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className={styles.stateCard}>
      <div className={styles.stateIcon}>
        <Icon name="clipboard" />
      </div>

      <h2>{title}</h2>

      <p>{message}</p>
    </div>
  );
}
