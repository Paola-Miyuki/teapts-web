import { request } from '@/lib/api';
import type { PaginationData } from '@/lib/professionals';

export type ProposalProfessional = {
  id: string;
  name: string;
  specialism: { id: string; name: string };
};

// Sem situação social para o paciente (RN028).
export type PtsProposal = {
  id: string;
  status: 'draft';
  socialSituation?: string;
  createdAt: string;
  patient: { id: string; name: string };
  responsible: ProposalProfessional;
  team: ProposalProfessional[];
};

export type ProposalsResponse = {
  data: PtsProposal[];
  pagination: PaginationData;
};

export type ProposalsQuery = {
  page: number;
  limit: number;
  q?: string;
  patientId?: string;
  signal?: AbortSignal;
};

// GET /pts/proposals: propostas em rascunho. Sem `patientId`, o admin vê
// todas, o profissional as de que é responsável ou membro e o paciente as
// próprias.
export function getProposals({ signal, ...query }: ProposalsQuery) {
  const params = new URLSearchParams();
  const term = query.q?.trim();

  if (query.patientId) {
    params.set('patientId', query.patientId);
  }

  if (term) {
    params.set('q', term);
  }

  params.set('page', String(query.page));
  params.set('limit', String(query.limit));

  return request<ProposalsResponse>(`/pts/proposals?${params.toString()}`, {
    signal,
  });
}
