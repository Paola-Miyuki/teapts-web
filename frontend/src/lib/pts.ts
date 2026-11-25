import { request } from '@/lib/api';
import type { ProfessionalRegistration } from '@/lib/professionals';
import { PTS_STATUS_LABELS, type PtsStatus } from '@/lib/pts-status';

export type ActivePtsStatus = 'planning' | 'running';

export type PtsProfessional = {
  id: string;
  name: string;
  specialism: {
    id: string;
    name: string;
  };
  registration: ProfessionalRegistration | null;
};

export type ActivePts = {
  id: string;
  status: ActivePtsStatus | string;
  socialSituation?: string;
  caseStudyDate?: string;
  diagnosisSummary?: string;
  cid?: string | null;
  supportLevel?: number | null;
  strengths?: string | null;
  priorityNeeds?: string[];
  vulnerabilities?: string | null;
  comorbidities?: string | null;
  sensoryProfile?: string | null;
  communicationMethod?: string | null;
  // O paciente só recebe a próxima revisão (RN028).
  nextReviewAt?: string;
  createdAt: string;
  acceptedAt: string | null;
  beganAt: string | null;
  patient: {
    id: string;
    name: string;
  };
  responsible: PtsProfessional;
  team: PtsProfessional[];
};

export function getPtsStatusLabel(status: string) {
  const key = status.toLowerCase() as PtsStatus;

  return PTS_STATUS_LABELS[key] ?? status;
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getActivePts(patientId: string) {
  const params = new URLSearchParams({ patientId });

  return request<ActivePts>(`/pts/active?${params.toString()}`);
}

// Ficha do PTS (RFPTS005): o corpo substitui a ficha inteira.
export type PtsSheetInput = {
  caseStudyDate: string;
  diagnosisSummary: string;
  cid: string | null;
  supportLevel: number | null;
  strengths: string | null;
  priorityNeeds: string[];
  socialSituation: string;
  vulnerabilities: string | null;
  comorbidities: string | null;
  sensoryProfile: string | null;
  communicationMethod: string | null;
  nextReviewAt: string;
};

export type UpdatePtsSheetResponse = PtsSheetInput & { id: string };

export function updatePtsSheet(id: string, sheet: PtsSheetInput) {
  return request<UpdatePtsSheetResponse>(
    `/pts/${encodeURIComponent(id)}/sheet`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheet),
    },
  );
}

export type PtsTeamResponse = {
  id: string;
  status: string;
  responsible: PtsProfessional;
  team: PtsProfessional[];
};

// DELETE /pts/:id/team/:professionalId
export function removeTeamMember(id: string, professionalId: string) {
  return request<PtsTeamResponse>(
    `/pts/${encodeURIComponent(id)}/team/${encodeURIComponent(professionalId)}`,
    { method: 'DELETE' },
  );
}

export function transferPtsResponsibility(
  id: string,
  newResponsibleId: string,
) {
  return request<PtsTeamResponse>(
    `/pts/${encodeURIComponent(id)}/team/transfer-responsibility`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newResponsibleId }),
    },
  );
}

export type PtsDetail = {
  id: string;
  status: PtsStatus;
  socialSituation?: string;
  caseStudyDate?: string;
  diagnosisSummary?: string;
  cid?: string | null;
  supportLevel?: number | null;
  strengths?: string | null;
  priorityNeeds?: string[];
  vulnerabilities?: string | null;
  comorbidities?: string | null;
  sensoryProfile?: string | null;
  communicationMethod?: string | null;
  // O paciente só recebe a próxima revisão (RN028).
  nextReviewAt?: string;
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  beganAt: string | null;
  concludedAt: string | null;
  cancelledAt: string | null;
  // Data e motivo informados ao encerrar (RFPTS010).
  closingDate?: string | null;
  closingReason?: string | null;
  patient: {
    id: string;
    name: string;
  };
  responsible: PtsProfessional;
  team: PtsProfessional[];
};

export type PtsHistoryItem = {
  id: string;
  version: number;
  status: PtsStatus;
  responsible: {
    id: string;
    name: string;
    specialism: string;
  };
  team: Array<{ id: string; name: string }>;
  createdAt: string;
  acceptedAt: string | null;
  beganAt: string | null;
  closedAt: string | null;
  goalsResult: {
    achieved: number;
    partiallyAchieved: number;
    notAchieved: number;
  } | null;
};

export type PtsHistoryResponse = {
  data: PtsHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function getPtsHistory(
  patientId: string,
  page: number,
  limit: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return request<PtsHistoryResponse>(
    `/patients/${encodeURIComponent(patientId)}/pts?${params.toString()}`,
    { signal },
  );
}

export function getPts(id: string, signal?: AbortSignal) {
  return request<PtsDetail>(`/pts/${encodeURIComponent(id)}`, { signal });
}

export type PtsCloseOutcome = 'concluded' | 'cancelled';

export type ClosePtsResponse = {
  id: string;
  status: PtsCloseOutcome;
  closingDate: string;
  closingReason: string | null;
};

export function closePts(
  id: string,
  body: { outcome: PtsCloseOutcome; closingDate: string; reason?: string },
) {
  return request<ClosePtsResponse>(`/pts/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type PtsStartResponse = {
  id: string;
  status: 'running';
  beganAt: string;
};

export function startPts(id: string) {
  return request<PtsStartResponse>(`/pts/${encodeURIComponent(id)}/start`, {
    method: 'POST',
  });
}
