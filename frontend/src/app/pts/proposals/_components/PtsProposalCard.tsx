import styles from '../proposals.module.css';

export type PtsProposal = {
  id: string;
  status?: string;
  socialSituation?: string;
  patient?: {
    id: string;
    name: string;
  };
  responsible?: {
    name: string;
    specialism?: {
      name: string;
    };
  };
  team?: Array<{
    id: string;
    name: string;
    specialism?: {
      name: string;
    };
  }>;
};

const statusMap: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Aguardando aprovação',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  completed: 'Concluída',
};

interface PtsProposalCardProps {
  proposal: PtsProposal;
  isPatient?: boolean;
  onOpenDecisionModal?: (
    proposalId: string,
    type: 'approve' | 'reject',
  ) => void;
}

export default function PtsProposalCard({
  proposal,
  isPatient = false,
  onOpenDecisionModal,
}: PtsProposalCardProps) {
  const profName =
    proposal.responsible?.name || 'Profissional não identificado';
  const profSpecialism =
    proposal.responsible?.specialism?.name || 'Especialidade não informada';
  const patientName = proposal.patient?.name || 'Paciente não informado';
  const socialSit =
    proposal.socialSituation || 'Situação social não preenchida.';
  const initial = profName.charAt(0).toUpperCase();

  const displayStatus = proposal.status
    ? statusMap[proposal.status.toLowerCase()] || proposal.status
    : 'Aguardando aprovação';

  return (
    <article
      className={styles.proposalCard}
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className={styles.personBanner}>
        <div className={styles.professionalIdentity}>
          <div className={styles.proposalAvatar}>{initial}</div>
          <div className={styles.personText}>
            <h2>{profName}</h2>
            <p>{profSpecialism} &middot; profissional responsável</p>
          </div>
        </div>
        <div className={styles.statusBadge}>{displayStatus}</div>
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Paciente</span>
          <span className={styles.metaValue}>
            <strong>{patientName}</strong>
          </span>
        </div>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Equipe multidisciplinar</span>
          <span className={styles.metaValue}>
            {proposal.team && proposal.team.length > 0
              ? `${proposal.team.length} profissional(is)`
              : 'Ainda não definida'}
          </span>
        </div>
      </div>

      <div className={styles.socialSituation}>
        <h3>Situação Social</h3>
        <p
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {socialSit}
        </p>
      </div>

      <div className={styles.teamSection}>
        <h3>Equipe</h3>
        {proposal.team && proposal.team.length > 0 ? (
          <div className={styles.teamList}>
            {proposal.team.map((member) => (
              <div key={member.id} className={styles.teamMember}>
                <div className={styles.teamAvatar}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong>{member.name}</strong>
                  <div className={styles.teamSpecialism}>
                    {member.specialism?.name || 'Especialidade não informada'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyTeam}>
            A equipe multidisciplinar ainda não possui outros profissionais
            definidos.
          </p>
        )}
      </div>

      {/* Ações de aprovação / rejeição exclusivas para o paciente */}
      {isPatient && onOpenDecisionModal && (
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 px-5 pb-5">
          <button
            type="button"
            onClick={() => onOpenDecisionModal(proposal.id, 'reject')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ffc107';
              e.currentTarget.style.color = '#1f2937';
              e.currentTarget.style.borderColor = '#ffc107';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#ff0000';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            style={{
              backgroundColor: 'transparent',
              color: '#dc2626',
              border: '1px solid #fecaca',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Rejeitar
          </button>

          <button
            type="button"
            onClick={() => onOpenDecisionModal(proposal.id, 'approve')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ffc107';
              e.currentTarget.style.color = '#1f2937';
              e.currentTarget.style.borderColor = '#ffc107';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#374151';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            style={{
              backgroundColor: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            Escolher esta equipe
          </button>
        </div>
      )}
    </article>
  );
}
