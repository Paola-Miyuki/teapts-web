'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api';
import type { PtsProposal } from '@/lib/proposals';
import { decideProposal, type ProposalDecision } from '../api';

const FEEDBACK: Record<ProposalDecision, string> = {
  approve: 'Proposta aprovada. O PTS está em planejamento.',
  reject: 'Proposta rejeitada.',
};

// Aprovar ou rejeitar uma proposta (RFPTS003): o paciente decide a própria; o
// admin, em nome do paciente (RN029). Decidida, a proposta sai da lista.
export function useProposalDecision(onDecided: (proposalId: string) => void) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    proposal: PtsProposal;
    decision: ProposalDecision;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  function start(proposal: PtsProposal, decision: ProposalDecision) {
    setError('');
    setFeedback('');
    setPending({ proposal, decision });
  }

  function cancel() {
    setPending(null);
    setError('');
  }

  async function confirm() {
    if (!pending) return;

    const { proposal, decision } = pending;

    setSubmitting(true);
    setError('');

    try {
      await decideProposal(proposal.id, decision);
      setPending(null);
      setFeedback(FEEDBACK[decision]);
      onDecided(proposal.id);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : 'Não foi possível registrar a decisão. Tente de novo',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return { pending, submitting, error, feedback, start, cancel, confirm };
}
