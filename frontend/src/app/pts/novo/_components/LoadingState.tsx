import styles from '../novo.module.css';

export function LoadingState({
  label = 'Carregando dados...',
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={styles.loading}>
      <span aria-hidden="true" className={styles.spinner} />
      {label}
    </div>
  );
}
