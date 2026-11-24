// Status do PTS (pts_state_e) e os rótulos das telas.
export const PTS_STATUSES = [
  'draft',
  'planning',
  'running',
  'concluded',
  'cancelled',
  'rejected',
] as const;

export type PtsStatus = (typeof PTS_STATUSES)[number];

export const PTS_STATUS_LABELS: Record<PtsStatus, string> = {
  draft: 'Em proposta',
  planning: 'Em planejamento',
  running: 'Em andamento',
  concluded: 'Concluído',
  cancelled: 'Cancelado',
  rejected: 'Rejeitado',
};
