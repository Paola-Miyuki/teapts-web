import ui from '@/components/ui.module.css';
import styles from '../professionals.module.css';

export default function LoadingState() {
  return (
    <div className={ui.empty} role="status" aria-live="polite">
      <div className={styles.loader} />

      <p>Carregando profissionais...</p>
    </div>
  );
}
