import type { PtsSheetInput } from '@/lib/pts';

export type Specialism = {
  id: string;
  name: string;
};

export type Professional = {
  id: string;
  name: string;
  email: string;
  specialism: Specialism;
};

export type ProfessionalsResponse = {
  data: Professional[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type UpdatePtsProposalPayload = PtsSheetInput & {
  teamProfessionalIds: string[];
};

export type ApiErrorBody = {
  status?: string;
  message?: string;
};
