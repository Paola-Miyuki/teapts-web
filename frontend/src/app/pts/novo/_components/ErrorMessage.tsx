import { forwardRef } from 'react';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage = forwardRef<HTMLDivElement, Props>(
  function ErrorMessage({ title, message, onRetry }, ref) {
    return (
      <div
        className={`${ui.alert} ${ui.alertError}`}
        role="alert"
        tabIndex={-1}
        ref={ref}
      >
        <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
          <Icon name="alertCircle" />
        </div>
        <div>
          {title && <strong>{title}</strong>}
          <p>{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={`${ui.btn} ${ui.btnSecondary}`}
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  },
);
