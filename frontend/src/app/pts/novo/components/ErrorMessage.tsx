import { forwardRef } from 'react';
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
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-[44px] font-semibold underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  },
);
