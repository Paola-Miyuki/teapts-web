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

export type UpdateSocialSituationResponse = {
  id: string;
  socialSituation: string;
};

export function updateSocialSituation(id: string, socialSituation: string) {
  return request<UpdateSocialSituationResponse>(
    `/pts/${encodeURIComponent(id)}/social-situation`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socialSituation }),
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
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  beganAt: string | null;
  concludedAt: string | null;
  cancelledAt: string | null;
  patient: {
    id: string;
    name: string;
  };
  responsible: PtsProfessional;
  team: PtsProfessional[];
};

export function getPts(id: string, signal?: AbortSignal) {
  return request<PtsDetail>(`/pts/${encodeURIComponent(id)}`, { signal });
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
