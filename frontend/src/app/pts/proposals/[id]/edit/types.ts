export type Specialism = {
  id: string;
  name: string;
};

export type ProposalPatient = {
  id: string;
  name: string;
};

export type ProposalProfessional = {
  id: string;
  name: string;
  specialism: Specialism;
};

export type ProposalTeamMember = {
  id: string;
  name: string;
  specialism: Specialism;
};

export type PtsProposal = {
  id: string;
  status: string;
  socialSituation: string;
  createdAt: string;
  patient: ProposalPatient;
  responsible: ProposalProfessional;
  team: ProposalTeamMember[];
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

export type UpdatePtsProposalPayload = {
  socialSituation: string;
  teamProfessionalIds: string[];
};

export type ApiErrorBody = {
  status?: string;
  message?: string;
};
