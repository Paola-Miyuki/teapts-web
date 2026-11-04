import React from 'react';

interface ProposalDecisionDialogProps {
  isOpen: boolean;
  type: 'approve' | 'reject' | null;
  isLoading: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProposalDecisionDialog({
  isOpen,
  type,
  isLoading,
  errorMessage,
  onConfirm,
  onCancel,
}: ProposalDecisionDialogProps) {
  if (!isOpen || !type) return null;

  const isApprove = type === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">
          {isApprove ? 'Aceitar proposta?' : 'Rejeitar proposta?'}
        </h3>

        <p className="mt-2 text-sm text-gray-600">
          {isApprove
            ? 'As outras propostas pendentes serão rejeitadas e o PTS entrará em fase de planejamento.'
            : 'Tem certeza de que deseja rejeitar esta proposta de PTS?'}
        </p>

        {errorMessage && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: isApprove ? '#ffc107' : '#dc2626',
              color: isApprove ? '#1f2937' : '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isLoading
              ? 'Enviando...'
              : isApprove
                ? 'Confirmar Escolha'
                : 'Confirmar Rejeição'}
          </button>
        </div>
      </div>
    </div>
  );
}
