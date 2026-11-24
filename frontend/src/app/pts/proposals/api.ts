import { request } from '@/lib/api';

export type ProposalDecision = 'approve' | 'reject';

export type PtsDecisionResponse = {
  id: string;
  status: 'planning' | 'rejected';
  acceptedAt: string | null;
  rejectedAt: string | null;
};

export type DeleteProposalResponse = {
  status: 'OK';
};

export function deleteProposal(id: string) {
  return request<DeleteProposalResponse>(
    `/pts/proposals/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export function decideProposal(id: string, decision: ProposalDecision) {
  return request<PtsDecisionResponse>(`/pts/proposals/${id}/${decision}`, {
    method: 'POST',
  });
}
