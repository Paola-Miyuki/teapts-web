import { forwardRef } from 'react';
import styles from '../novo.module.css';
import { alertCls } from '../styles';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage = forwardRef<HTMLDivElement, Props>(
  function ErrorMessage({ title, message, onRetry }, ref) {
    return (
      <div className={alertCls} role="alert" tabIndex={-1} ref={ref}>
        {title && <p className={styles.alertTitle}>{title}</p>}
        <p className={styles.alertMessage}>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={styles.retry}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  },
);
