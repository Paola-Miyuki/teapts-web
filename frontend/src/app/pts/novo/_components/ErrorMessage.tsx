import { forwardRef } from 'react';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
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
      <div
        className={`${alertCls} ${ui.alertError}`}
        role="alert"
        tabIndex={-1}
        ref={ref}
      >
        <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
          <Icon name="alertCircle" />
        </div>
        <div>
          {title && <p className={styles.alertTitle}>{title}</p>}
          <p className={styles.alertMessage}>{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className={styles.retry}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  },
);
