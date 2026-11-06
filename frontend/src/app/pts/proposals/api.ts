import { request } from '@/lib/api';

export type ProposalDecision = 'approve' | 'reject';

export type PtsDecisionResponse = {
  id: string;
  status: 'planning' | 'rejected';
  acceptedAt: string | null;
  rejectedAt: string | null;
};

export function decideProposal(id: string, decision: ProposalDecision) {
  return request<PtsDecisionResponse>(`/pts/proposals/${id}/${decision}`, {
    method: 'POST',
  });
}
