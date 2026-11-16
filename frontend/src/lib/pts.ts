import { request } from '@/lib/api';

// Mesmos valores do PtsStateEnum da API.
export type ActivePtsStatus = 'planning' | 'running';

export type PtsProfessional = {
  id: string;
  name: string;
  specialism: {
    id: string;
    name: string;
  };
};

// GET /pts/active: a API omite `socialSituation` quando quem consulta é o
// próprio paciente (DP003).
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

export const PTS_STATUS_LABELS: Record<ActivePtsStatus, string> = {
  planning: 'Em planejamento',
  running: 'Em execução',
};

// A API usa minúsculas, mas o contrato da issue mostra "PLANNING".
export function getPtsStatusLabel(status: string) {
  const key = status.toLowerCase() as ActivePtsStatus;

  return PTS_STATUS_LABELS[key] ?? status;
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET /pts/active?patientId=<uuid> (RFPTS004).
export function getActivePts(patientId: string) {
  const params = new URLSearchParams({ patientId });

  return request<ActivePts>(`/pts/active?${params.toString()}`);
}
