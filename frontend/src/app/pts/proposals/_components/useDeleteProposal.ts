'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api';
import type { PtsProposal } from '@/lib/proposals';
import { deleteProposal } from '../api';

const DELETE_ERROR = 'Não foi possível excluir a proposta. Tente de novo';

// Excluir proposta em `draft` (RFPTS008): exclusão lógica; depois dela a
// proposta sai da lista.
export function useDeleteProposal(onDeleted: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState<PtsProposal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  function start(proposal: PtsProposal) {
    setError('');
    setFeedback('');
    setPending(proposal);
  }

  function cancel() {
    setPending(null);
    setError('');
  }

  async function confirm() {
    if (!pending || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await deleteProposal(pending.id);
      setPending(null);
      setFeedback('Proposta excluída');
      onDeleted();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : DELETE_ERROR,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return { pending, submitting, error, feedback, start, cancel, confirm };
}
