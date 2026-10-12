import React from 'react';

interface ErrorMessageProps {
  message: string | null;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="notice notice-error" role="alert" style={{ color: '#d32f2f', backgroundColor: '#fde8e8', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
      <strong>Atenção:</strong> {message}
    </div>
  );
};