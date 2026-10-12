import React from 'react';

interface SubmitButtonProps {
  isLoading: boolean;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({ isLoading }) => {
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={isLoading}
      style={{
        padding: '12px 24px',
        backgroundColor: isLoading ? '#a0aec0' : '#2b6cb0',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 600,
        cursor: isLoading ? 'not-allowed' : 'pointer',
      }}
    >
      {isLoading ? 'Criando proposta...' : 'Criar Proposta de PTS'}
    </button>
  );
};