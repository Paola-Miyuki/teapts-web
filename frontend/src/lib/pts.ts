import { request } from '@/lib/api';
import type { ProfessionalRegistration } from '@/lib/professionals';
import type { PtsStatus } from '@/lib/pts-status';

export type PtsProfessional = {
  id: string;
  name: string;
  specialism: { id: string; name: string };
  registration: ProfessionalRegistration | null;
};

// Sem situação social para o paciente (RN028).
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
  patient: { id: string; name: string };
  responsible: PtsProfessional;
  team: PtsProfessional[];
};

// GET /pts/:id: admin, equipe (RN016) ou o próprio paciente (RN028).
export function getPts(id: string, signal?: AbortSignal) {
  return request<PtsDetail>(`/pts/${encodeURIComponent(id)}`, { signal });
}
